import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DeleteAnnouncementButton from '@/components/DeleteAnnouncementButton';
import { updateAnnouncementStatus } from './actions';
import { sanitizeAnnouncementHtml } from '@/lib/announcement-html';
import FormFeedback from '@/components/FormFeedback';



export default async function ManageAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies.
            // Session refresh should be handled by proxy.ts.
          }
        },
      },
    }
  );

  // 1. Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // 2. Retrieve role
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .single();

    if (userError || !userData) {
    console.error('USER PROFILE ERROR:', userError);
    throw new Error('Unable to retrieve user profile');
    }
  const { data: roleData, error: roleError } = await supabase
    .from('roles')
    .select('role_name')
    .eq('id', userData.role_id)
    .single();



  if (roleError || !roleData) {
    console.error('USER ROLE ERROR:', roleError);
  throw new Error('Unable to retrieve user role');
}

  const roleName = roleData.role_name?.trim();

  if (roleName !== 'MPP' && roleName !== 'Admin') {
    redirect('/feed?error=unauthorized');
  }

  // 3. Retrieve current publisher's announcements
  const { data: announcements, error: announcementsError } =
    await supabase
      .from('announcements')
      .select(`
        id,
        title,
        body,
        status,
        audience_type,
        is_urgent,
        created_at
      `)
      .eq('publisher_id', user.id)
      .order('created_at', { ascending: false });

    if (announcementsError) {
        console.error('ANNOUNCEMENTS ERROR:', announcementsError);
        throw new Error('Failed to load announcements');
    }

    const announcementIds = (announcements ?? []).map((post) => post.id);

    let viewRecords: { announcement_id: string }[] = [];

    if (announcementIds.length > 0) {
    const { data, error } = await supabase
        .from('announcement_views')
        .select('announcement_id')
        .in('announcement_id', announcementIds);

    if (error) {
        console.error('Failed to load announcement views:', error);
    } else {
        viewRecords = data ?? [];
    }
    }

    // Count unique views per announcement
    const viewCounts: Record<string, number> = {};

    for (const view of viewRecords) {
    viewCounts[view.announcement_id] =
        (viewCounts[view.announcement_id] ?? 0) + 1;
    }

    // Total unique announcement views
    const totalViews = Object.values(viewCounts).reduce(
    (sum, count) => sum + count,
    0
    );


  const posts = announcements || [];

  // Retrieve target audience records for these announcements.
  const { data: targets, error: targetsError } =
    announcementIds.length > 0
        ? await supabase
            .from('announcement_targets')
            .select(`
            announcement_id,
            programme_id,
            semester,
            programmes (
                code,
                name
            )
            `)
            .in('announcement_id', announcementIds)
        : { data: [], error: null };

    if (targetsError) {
    console.error('TARGETS ERROR:', targetsError);
    throw new Error('Failed to load target audiences');
    }

    // Group target records by announcement.
    const targetsByAnnouncement = new Map<
    string,
    {
        programmeCodes: string[];
        semesters: number[];
    }
    >();

    for (const target of targets ?? []) {
    const current = targetsByAnnouncement.get(target.announcement_id) ?? {
        programmeCodes: [],
        semesters: [],
    };

    // Supabase returns the related programme as an object
    // for this many-to-one relationship.
    const programme = target.programmes;

    if (
        programme?.code &&
        !current.programmeCodes.includes(programme.code)
    ) {
        current.programmeCodes.push(programme.code);
    }

    if (!current.semesters.includes(target.semester)) {
        current.semesters.push(target.semester);
    }

    targetsByAnnouncement.set(target.announcement_id, current);
    }

  // 4. Calculate summary statistics
  const totalPosts = posts.length;
  const publishedPosts = posts.filter(
    (post) => post.status === 'published'
  ).length;
  const draftPosts = posts.filter(
    (post) => post.status === 'draft'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/feed"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              ← Back to Feed
            </Link>

            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              My Announcements
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage your published announcements and drafts.
            </p>
          </div>

          <Link
            href="/create"
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Create Announcement
          </Link>
        </div>

        <FormFeedback
            type="success"
            message={resolvedSearchParams.success}
        />

        <FormFeedback
            type="error"
            message={resolvedSearchParams.error}
        />

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
                { label: 'Total Announcements', value: totalPosts },
                { label: 'Published', value: publishedPosts },
                { label: 'Drafts', value: draftPosts },
                { label: 'Total Unique Views', value: totalViews },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Announcement List */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-900">
              Your Posts
            </h2>
          </div>

          {posts.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-slate-700">
                No announcements yet
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Create your first announcement to get started.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {post.title}
                      </h3>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          post.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {post.status === 'published'
                          ? 'Published'
                          : 'Draft'}
                      </span>

                      {post.is_urgent && (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                          Urgent
                        </span>
                      )}
                    </div>

                    <div
                        className="announcement-content mt-1 max-h-24 overflow-hidden text-sm text-slate-500"
                        dangerouslySetInnerHTML={{
                            __html: sanitizeAnnouncementHtml(post.body ?? ''),
                        }}
                    />

                    {/* Target Audience */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-600">
                            Target Audience:
                        </span>

                        {post.audience_type === 'all' ? (
                            <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                            All Students
                            </span>
                        ) : (
                            <>
                            {(() => {
                                const target = targetsByAnnouncement.get(post.id);

                                if (!target || target.programmeCodes.length === 0) {
                                return (
                                    <span className="font-medium text-red-600">
                                    No target audience configured
                                    </span>
                                );
                                }

                                return (
                                <>
                                    {target.programmeCodes.map((code) => (
                                    <span
                                        key={code}
                                        className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700"
                                    >
                                        {code}
                                    </span>
                                    ))}

                                    <span className="text-slate-500">
                                    Semesters {target.semesters.sort((a, b) => a - b).join(', ')}
                                    </span>
                                </>
                                );
                            })()}
                            </>
                        )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                        <span>
                            Created{' '}
                            {new Date(post.created_at).toLocaleDateString('en-MY', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            })}
                        </span>

                        <span className="flex items-center gap-1 font-medium text-blue-600">
                            <span aria-hidden="true">👁</span>
                            {viewCounts[post.id] ?? 0} unique views
                        </span>
                        </div>
                  </div>

                  {/* Edit */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href={`/manage/${post.id}/edit`}
                        className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    >
                        Edit
                    </Link>

                    <form action={updateAnnouncementStatus}>
                        <input
                        type="hidden"
                        name="announcement_id"
                        value={post.id}
                        />

                        <input
                        type="hidden"
                        name="status"
                        value={post.status === 'draft' ? 'published' : 'draft'}
                        />

                        <button
                        type="submit"
                        className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                            post.status === 'draft'
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                        >
                        {post.status === 'draft' ? 'Publish' : 'Unpublish'}
                        </button>
                    </form>

                    <DeleteAnnouncementButton
                        announcementId={post.id}
                        announcementTitle={post.title}
                    />
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}