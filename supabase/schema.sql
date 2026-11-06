


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."admin_moderate_announcement"("p_announcement_id" "uuid", "p_action" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_announcement public.announcements%ROWTYPE;
BEGIN
  -- 1. Authenticate and authorize.
  IF (SELECT auth.uid()) IS NULL
     OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  -- 2. Validate requested action.
  IF p_action IS NULL
     OR p_action NOT IN (
       'publish',
       'unpublish',
       'toggle_urgent'
     ) THEN
    RAISE EXCEPTION 'Invalid moderation action';
  END IF;

  -- 3. Retrieve and lock the announcement.
  SELECT *
  INTO v_announcement
  FROM public.announcements
  WHERE id = p_announcement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;

  -- 4. Publish announcement.
  IF p_action = 'publish' THEN

    IF NULLIF(TRIM(v_announcement.title), '') IS NULL
       OR NULLIF(TRIM(v_announcement.body), '') IS NULL THEN
      RAISE EXCEPTION
        'Announcement requires a title and body';
    END IF;

    -- Ensure targeted announcements have valid targets.
    IF v_announcement.audience_type = 'targeted' THEN

      IF NOT EXISTS (
        SELECT 1
        FROM public.announcement_targets at
        JOIN public.programmes p
          ON p.id = at.programme_id
        WHERE at.announcement_id = p_announcement_id
          AND p.is_active = TRUE
          AND at.semester BETWEEN 1 AND 6
      ) THEN
        RAISE EXCEPTION
          'Targeted announcement has no valid audience';
      END IF;

      -- Reject announcements with invalid targets.
      IF EXISTS (
        SELECT 1
        FROM public.announcement_targets at
        LEFT JOIN public.programmes p
          ON p.id = at.programme_id
        WHERE at.announcement_id = p_announcement_id
          AND (
            p.id IS NULL
            OR p.is_active IS DISTINCT FROM TRUE
            OR at.semester IS NULL
            OR at.semester NOT BETWEEN 1 AND 6
          )
      ) THEN
        RAISE EXCEPTION
          'Targeted announcement contains invalid targets';
      END IF;

    ELSIF v_announcement.audience_type IS DISTINCT FROM 'all' THEN
      RAISE EXCEPTION 'Invalid audience type';
    END IF;

    UPDATE public.announcements
    SET
      status = 'published',
      published_at = CASE
        WHEN v_announcement.status = 'published'
          THEN v_announcement.published_at
        ELSE NOW()
      END,
      updated_at = NOW()
    WHERE id = p_announcement_id;

  -- 5. Unpublish announcement.
  ELSIF p_action = 'unpublish' THEN

    UPDATE public.announcements
    SET
      status = 'draft',
      published_at = NULL,
      updated_at = NOW()
    WHERE id = p_announcement_id;

  -- 6. Toggle urgency.
  ELSIF p_action = 'toggle_urgent' THEN

    UPDATE public.announcements
    SET
      is_urgent = NOT COALESCE(is_urgent, FALSE),
      updated_at = NOW()
    WHERE id = p_announcement_id;

  END IF;
END;
$$;


ALTER FUNCTION "public"."admin_moderate_announcement"("p_announcement_id" "uuid", "p_action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_user_role"("p_user_id" "uuid", "p_role_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_role_name TEXT;
BEGIN
  -- Verify the caller is an Admin.
  IF auth.uid() IS NULL
     OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  -- Prevent self-demotion or self-role changes.
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  -- Accept only the official application roles.
  SELECT role_name
  INTO v_role_name
  FROM public.roles
  WHERE id = p_role_id;

  IF v_role_name IS NULL
     OR v_role_name NOT IN ('Student', 'MPP', 'Admin') THEN
    RAISE EXCEPTION 'Invalid role selection';
  END IF;

  -- Update the requested user.
  UPDATE public.users
  SET
    role_id = p_role_id,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;


ALTER FUNCTION "public"."admin_set_user_role"("p_user_id" "uuid", "p_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_default_role_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id 
  FROM public.roles 
  WHERE role_name = 'Student' 
  LIMIT 1;

  RETURN v_role_id;
END;
$$;


ALTER FUNCTION "public"."get_default_role_id"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "body" "text" NOT NULL,
    "publisher_id" "uuid" NOT NULL,
    "is_urgent" boolean DEFAULT false NOT NULL,
    "attachment_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "audience_type" "text" DEFAULT 'all'::"text" NOT NULL,
    "event_start" timestamp with time zone,
    "event_end" timestamp with time zone,
    "event_location" "text",
    CONSTRAINT "announcements_audience_type_check" CHECK (("audience_type" = ANY (ARRAY['all'::"text", 'targeted'::"text"]))),
    CONSTRAINT "announcements_event_dates_check" CHECK (((("event_start" IS NULL) AND ("event_end" IS NULL)) OR (("event_start" IS NOT NULL) AND ("event_end" IS NOT NULL) AND ("event_end" > "event_start")))),
    CONSTRAINT "announcements_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_personalized_feed"("p_user_id" "uuid") RETURNS SETOF "public"."announcements"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT a.*
  FROM public.announcements a
  LEFT JOIN public.announcement_categories ac ON ac.announcement_id = a.id
  LEFT JOIN public.user_subscriptions us ON us.category_id = ac.category_id AND us.user_id = p_user_id
  -- Show the post if the user is subscribed OR if it is an urgent campus alert
  WHERE us.user_id IS NOT NULL OR a.is_urgent = true
  ORDER BY a.created_at DESC;
$$;


ALTER FUNCTION "public"."get_personalized_feed"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    public.get_default_role_id()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.roles r
      ON r.id = u.role_id
    WHERE u.id = (SELECT auth.uid())
      AND r.role_name = 'Admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."matches_announcement_target"("p_announcement_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_profiles sp
    JOIN public.announcement_targets at
      ON at.programme_id = sp.programme_id
     AND at.semester = sp.semester
    WHERE sp.user_id = (SELECT auth.uid())
      AND at.announcement_id = p_announcement_id
  );
$$;


ALTER FUNCTION "public"."matches_announcement_target"("p_announcement_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_my_subscriptions"("p_category_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_category_ids UUID[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Deduplicate the requested IDs.
  v_category_ids := ARRAY(
    SELECT DISTINCT selected.category_id
    FROM unnest(COALESCE(p_category_ids, ARRAY[]::UUID[]))
      AS selected(category_id)
  );

  -- Only existing, active categories may be selected.
  IF EXISTS (
    SELECT 1
    FROM unnest(v_category_ids) AS selected(category_id)
    LEFT JOIN public.categories c
      ON c.id = selected.category_id
      AND c.is_active = TRUE
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid subscription category';
  END IF;

  DELETE FROM public.user_subscriptions
  WHERE user_id = v_user_id;

  INSERT INTO public.user_subscriptions (
    user_id,
    category_id
  )
  SELECT
    v_user_id,
    selected.category_id
  FROM unnest(v_category_ids) AS selected(category_id);
END;
$$;


ALTER FUNCTION "public"."save_my_subscriptions"("p_category_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_announcement_details"("p_announcement_id" "uuid", "p_title" "text", "p_body" "text", "p_is_urgent" boolean, "p_audience_type" "text", "p_category_ids" "uuid"[], "p_programme_ids" "uuid"[], "p_semesters" integer[], "p_event_start" timestamp with time zone, "p_event_end" timestamp with time zone, "p_event_location" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
BEGIN
  -- 1. Verify authentication
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Verify publisher role
  SELECT r.role_name
  INTO v_role
  FROM public.users u
  JOIN public.roles r
    ON r.id = u.role_id
  WHERE u.id = v_user_id;

  IF v_role IS NULL
     OR v_role NOT IN ('MPP', 'Admin') THEN
    RAISE EXCEPTION 'Publisher permission required';
  END IF;

  -- 3. Verify announcement ownership
  -- Lock the record during the update.
  PERFORM 1
  FROM public.announcements
  WHERE id = p_announcement_id
    AND publisher_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Announcement not found or access denied';
  END IF;

  -- 4. Validate title and body
  IF NULLIF(TRIM(p_title), '') IS NULL
     OR NULLIF(TRIM(p_body), '') IS NULL THEN
    RAISE EXCEPTION 'Title and body are required';
  END IF;

  -- 5. Validate audience type
  IF p_audience_type IS NULL
     OR p_audience_type NOT IN ('all', 'targeted') THEN
    RAISE EXCEPTION 'Invalid audience type';
  END IF;

  -- 6. Validate event information
  IF (p_event_start IS NULL) <> (p_event_end IS NULL) THEN
    RAISE EXCEPTION
      'Both event start and end are required';
  END IF;

  IF p_event_start IS NOT NULL
     AND p_event_end <= p_event_start THEN
    RAISE EXCEPTION
      'Event end must be after event start';
  END IF;

  IF LENGTH(COALESCE(p_event_location, '')) > 200 THEN
    RAISE EXCEPTION 'Event location is too long';
  END IF;

  IF p_event_start IS NULL
     AND NULLIF(TRIM(p_event_location), '') IS NOT NULL THEN
    RAISE EXCEPTION
      'Event location requires event dates';
  END IF;

  -- 7. Validate targeted broadcast
  IF p_audience_type = 'targeted' THEN

    -- At least one programme and semester required.
    IF COALESCE(CARDINALITY(p_programme_ids), 0) = 0
       OR COALESCE(CARDINALITY(p_semesters), 0) = 0 THEN
      RAISE EXCEPTION
        'Select programmes and semesters';
    END IF;

    -- Validate semesters.
    IF EXISTS (
      SELECT 1
      FROM UNNEST(p_semesters) AS s(semester)
      WHERE s.semester IS NULL
         OR s.semester NOT BETWEEN 1 AND 9
    ) THEN
      RAISE EXCEPTION 'Invalid semester';
    END IF;

    -- Validate selected programmes.
    IF EXISTS (
      SELECT 1
      FROM UNNEST(p_programme_ids)
        AS selected(programme_id)
      LEFT JOIN public.programmes p
        ON p.id = selected.programme_id
       AND p.is_active = TRUE
      WHERE p.id IS NULL
    ) THEN
      RAISE EXCEPTION
        'Invalid or inactive programme';
    END IF;

  END IF;

  -- 8. Update announcement details
  UPDATE public.announcements
  SET
    title = TRIM(p_title),
    body = p_body,
    audience_type = p_audience_type,
    event_start = p_event_start,
    event_end = p_event_end,
    event_location = NULLIF(TRIM(p_event_location), ''),
    updated_at = NOW()
  WHERE id = p_announcement_id
    AND publisher_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Announcement update denied';
  END IF;

  -- IMPORTANT:
  -- is_urgent is deliberately NOT updated.
  -- Only the Admin moderation function should change it.

  -- 9. Replace announcement categories
  DELETE FROM public.announcement_categories
  WHERE announcement_id = p_announcement_id;

  INSERT INTO public.announcement_categories (
    announcement_id,
    category_id
  )
  SELECT
    p_announcement_id,
    selected.category_id
  FROM (
    SELECT DISTINCT UNNEST(p_category_ids)
      AS category_id
  ) selected;

  -- 10. Replace existing target audience
  DELETE FROM public.announcement_targets
  WHERE announcement_id = p_announcement_id;

  -- 11. Insert new targeting combinations
  IF p_audience_type = 'targeted' THEN

    INSERT INTO public.announcement_targets (
      announcement_id,
      programme_id,
      semester
    )
    SELECT
      p_announcement_id,
      selected_programmes.programme_id,
      selected_semesters.semester
    FROM (
      SELECT DISTINCT UNNEST(p_programme_ids)
        AS programme_id
    ) selected_programmes
    CROSS JOIN (
      SELECT DISTINCT UNNEST(p_semesters)
        AS semester
    ) selected_semesters;

  END IF;

END;$$;


ALTER FUNCTION "public"."update_announcement_details"("p_announcement_id" "uuid", "p_title" "text", "p_body" "text", "p_is_urgent" boolean, "p_audience_type" "text", "p_category_ids" "uuid"[], "p_programme_ids" "uuid"[], "p_semesters" integer[], "p_event_start" timestamp with time zone, "p_event_end" timestamp with time zone, "p_event_location" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcement_categories" (
    "announcement_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL
);


ALTER TABLE "public"."announcement_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcement_targets" (
    "announcement_id" "uuid" NOT NULL,
    "programme_id" "uuid" NOT NULL,
    "semester" integer NOT NULL,
    CONSTRAINT "announcement_targets_semester_check" CHECK ((("semester" >= 1) AND ("semester" <= 9)))
);


ALTER TABLE "public"."announcement_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcement_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "announcement_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."announcement_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programmes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(20) NOT NULL,
    "name" character varying(150) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."programmes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "role_name" character varying(50) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_profiles" (
    "user_id" "uuid" NOT NULL,
    "course_name" character varying,
    "semester" integer,
    "enrollment_year" integer,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "programme_id" "uuid",
    CONSTRAINT "student_profiles_semester_check" CHECK ((("semester" >= 1) AND ("semester" <= 9)))
);


ALTER TABLE "public"."student_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255),
    "role_id" "uuid" DEFAULT "public"."get_default_role_id"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."announcement_categories"
    ADD CONSTRAINT "announcement_categories_pkey" PRIMARY KEY ("announcement_id", "category_id");



ALTER TABLE ONLY "public"."announcement_targets"
    ADD CONSTRAINT "announcement_targets_pkey" PRIMARY KEY ("announcement_id", "programme_id", "semester");



ALTER TABLE ONLY "public"."announcement_views"
    ADD CONSTRAINT "announcement_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."programmes"
    ADD CONSTRAINT "programmes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."programmes"
    ADD CONSTRAINT "programmes_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."programmes"
    ADD CONSTRAINT "programmes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_role_name_key" UNIQUE ("role_name");



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."announcement_views"
    ADD CONSTRAINT "unique_announcement_viewer" UNIQUE ("announcement_id", "user_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("user_id", "category_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_announcement_views_announcement_id" ON "public"."announcement_views" USING "btree" ("announcement_id");



ALTER TABLE ONLY "public"."announcement_categories"
    ADD CONSTRAINT "announcement_categories_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_categories"
    ADD CONSTRAINT "announcement_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_targets"
    ADD CONSTRAINT "announcement_targets_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_targets"
    ADD CONSTRAINT "announcement_targets_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id");



ALTER TABLE ONLY "public"."announcement_views"
    ADD CONSTRAINT "announcement_views_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_views"
    ADD CONSTRAINT "announcement_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id");



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;



CREATE POLICY "Admins can create categories" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update categories" ON "public"."categories" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can view all announcements" ON "public"."announcements" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can view all categories" ON "public"."categories" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can view all users" ON "public"."users" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can view roles" ON "public"."roles" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Allow read access on roles for authenticated users" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read roles" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view active programmes" ON "public"."programmes" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Authors or Admins can delete announcements" ON "public"."announcements" FOR DELETE TO "authenticated" USING ((("publisher_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
  WHERE (("u"."id" = "auth"."uid"()) AND (("r"."role_name")::"text" = 'Admin'::"text"))))));



CREATE POLICY "MPP and Admin can assign announcement categories" ON "public"."announcement_categories" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."announcements" "a"
     JOIN "public"."users" "u" ON (("u"."id" = "a"."publisher_id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "u"."role_id")))
  WHERE (("a"."id" = "announcement_categories"."announcement_id") AND ("a"."publisher_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("r"."role_name")::"text" = ANY ((ARRAY['MPP'::character varying, 'Admin'::character varying])::"text"[]))))));



CREATE POLICY "MPP and Admin can create own announcements" ON "public"."announcements" FOR INSERT TO "authenticated" WITH CHECK ((("publisher_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("r"."id" = "u"."role_id")))
  WHERE (("u"."id" = ( SELECT "auth"."uid"() AS "uid")) AND (("r"."role_name")::"text" = ANY ((ARRAY['MPP'::character varying, 'Admin'::character varying])::"text"[])))))));



CREATE POLICY "Publishers can delete own announcement categories" ON "public"."announcement_categories" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."announcements" "a"
     JOIN "public"."users" "u" ON (("u"."id" = "a"."publisher_id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "u"."role_id")))
  WHERE (("a"."id" = "announcement_categories"."announcement_id") AND ("a"."publisher_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("r"."role_name")::"text" = ANY ((ARRAY['MPP'::character varying, 'Admin'::character varying])::"text"[]))))));



CREATE POLICY "Publishers can delete own targets" ON "public"."announcement_targets" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."announcements" "a"
  WHERE (("a"."id" = "announcement_targets"."announcement_id") AND ("a"."publisher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Publishers can insert own targets" ON "public"."announcement_targets" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."announcements" "a"
  WHERE (("a"."id" = "announcement_targets"."announcement_id") AND ("a"."publisher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Publishers can read own targets" ON "public"."announcement_targets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."announcements" "a"
  WHERE (("a"."id" = "announcement_targets"."announcement_id") AND ("a"."publisher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Publishers can update own announcements" ON "public"."announcements" FOR UPDATE TO "authenticated" USING ((("publisher_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("r"."id" = "u"."role_id")))
  WHERE (("u"."id" = ( SELECT "auth"."uid"() AS "uid")) AND (("r"."role_name")::"text" = ANY ((ARRAY['MPP'::character varying, 'Admin'::character varying])::"text"[]))))))) WITH CHECK ((("publisher_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("r"."id" = "u"."role_id")))
  WHERE (("u"."id" = ( SELECT "auth"."uid"() AS "uid")) AND (("r"."role_name")::"text" = ANY ((ARRAY['MPP'::character varying, 'Admin'::character varying])::"text"[])))))));



CREATE POLICY "Publishers can view engagement for own announcements" ON "public"."announcement_views" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."announcements" "a"
     JOIN "public"."users" "u" ON (("u"."id" = "a"."publisher_id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "u"."role_id")))
  WHERE (("a"."id" = "announcement_views"."announcement_id") AND ("a"."publisher_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("r"."role_name")::"text" = ANY ((ARRAY['MPP'::character varying, 'Admin'::character varying])::"text"[]))))));



CREATE POLICY "Read announcements for intended audience" ON "public"."announcements" FOR SELECT TO "authenticated" USING (((("status" = 'published'::"text") AND (("audience_type" = 'all'::"text") OR "public"."matches_announcement_target"("id"))) OR (("publisher_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("r"."id" = "u"."role_id")))
  WHERE (("u"."id" = ( SELECT "auth"."uid"() AS "uid")) AND (("r"."role_name")::"text" = ANY ((ARRAY['MPP'::character varying, 'Admin'::character varying])::"text"[]))))))));



CREATE POLICY "Read categories for accessible announcements" ON "public"."announcement_categories" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."announcements" "a"
  WHERE ("a"."id" = "announcement_categories"."announcement_id"))));



CREATE POLICY "Roles are viewable by everyone" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can delete their own subscriptions" ON "public"."user_subscriptions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."student_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own subscriptions" ON "public"."user_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own record" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can record own published announcement views" ON "public"."announcement_views" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."announcements" "a"
  WHERE (("a"."id" = "announcement_views"."announcement_id") AND ("a"."status" = 'published'::"text"))))));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view all profiles" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view their own profile" ON "public"."student_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscriptions" ON "public"."user_subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "View active categories" ON "public"."categories" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."announcement_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcement_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcement_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programmes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."admin_moderate_announcement"("p_announcement_id" "uuid", "p_action" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_moderate_announcement"("p_announcement_id" "uuid", "p_action" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_set_user_role"("p_user_id" "uuid", "p_role_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_user_role"("p_user_id" "uuid", "p_role_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_default_role_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_default_role_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_default_role_id"() TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_personalized_feed"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."matches_announcement_target"("p_announcement_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."matches_announcement_target"("p_announcement_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."save_my_subscriptions"("p_category_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_my_subscriptions"("p_category_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_announcement_details"("p_announcement_id" "uuid", "p_title" "text", "p_body" "text", "p_is_urgent" boolean, "p_audience_type" "text", "p_category_ids" "uuid"[], "p_programme_ids" "uuid"[], "p_semesters" integer[], "p_event_start" timestamp with time zone, "p_event_end" timestamp with time zone, "p_event_location" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_announcement_details"("p_announcement_id" "uuid", "p_title" "text", "p_body" "text", "p_is_urgent" boolean, "p_audience_type" "text", "p_category_ids" "uuid"[], "p_programme_ids" "uuid"[], "p_semesters" integer[], "p_event_start" timestamp with time zone, "p_event_end" timestamp with time zone, "p_event_location" "text") TO "authenticated";


















GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcement_categories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcement_categories" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcement_categories" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcement_targets" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcement_targets" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcement_targets" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcement_views" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcement_views" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcement_views" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."categories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."categories" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."categories" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."programmes" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."programmes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."programmes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."student_profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_subscriptions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."users" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."users" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."users" TO "service_role";



GRANT UPDATE("full_name") ON TABLE "public"."users" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";































