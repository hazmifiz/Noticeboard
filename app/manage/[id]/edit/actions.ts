'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  sanitizeAnnouncementHtml,
  hasAnnouncementText,
} from '@/lib/announcement-html';
import { malaysiaLocalToUTC } from '@/lib/event-date';
import {
  actionError,
  type ActionState,
} from '@/lib/action-state';

import { getFriendlyActionError } from '@/lib/action-errors';



export async function updateAnnouncement(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
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
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect('/login');

  // Verify publisher role
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .single();

  if (userError || !userData) {
    throw new Error('Unable to retrieve user profile');
  }

  const { data: roleData, error: roleError } = await supabase
    .from('roles')
    .select('role_name')
    .eq('id', userData.role_id)
    .single();

  if (roleError || !roleData) {
    throw new Error('Unable to retrieve user role');
  }

  const roleName = roleData.role_name?.trim();

  if (roleName !== 'MPP' && roleName !== 'Admin') {
    redirect('/feed?error=unauthorized');
  }

  try {
  // Read form data
  const announcementId = formData.get('announcement_id');

  const title = formData.get('title');

  const rawBody = formData.get('body');

  if (typeof rawBody !== 'string') {
    throw new Error('Invalid announcement body');
  }

  const body = sanitizeAnnouncementHtml(rawBody);

  if (!hasAnnouncementText(body)) {
    throw new Error('Announcement body cannot be empty');
  }


  const categoryIds = formData
    .getAll('categories')
    .filter((id): id is string => typeof id === 'string');


  
  // Calendar Integration: read optional event information
  const rawEventStart = formData.get('event_start');
  const rawEventEnd = formData.get('event_end');
  const rawEventLocation = formData.get('event_location');

  if (
    typeof rawEventStart !== 'string' ||
    typeof rawEventEnd !== 'string' ||
    typeof rawEventLocation !== 'string'
  ) {
    throw new Error('Invalid event information');
  }

  const eventStartInput = rawEventStart.trim();
  const eventEndInput = rawEventEnd.trim();
  const eventLocation = rawEventLocation.trim();

  // Both dates must either exist or be empty.
  if (Boolean(eventStartInput) !== Boolean(eventEndInput)) {
    throw new Error(
      'Please provide both event start and end dates'
    );
  }

  if (eventLocation.length > 200) {
    throw new Error(
      'Event location must be 200 characters or fewer'
    );
  }

  let eventStart: string | null = null;
  let eventEnd: string | null = null;

  if (eventStartInput && eventEndInput) {
    eventStart = malaysiaLocalToUTC(eventStartInput);
    eventEnd = malaysiaLocalToUTC(eventEndInput);

    if (
      new Date(eventEnd).getTime() <=
      new Date(eventStart).getTime()
    ) {
      throw new Error(
        'Event end date must be later than the start date'
      );
    }
  }

  if (!eventStart && eventLocation) {
    throw new Error(
      'Please provide event dates when specifying an event location'
    );
  }


  const audienceType = formData.get('audience_type');

  if (audienceType !== 'all' && audienceType !== 'targeted') {
    throw new Error('Invalid target audience');
  }

  const programmeIds =
    audienceType === 'targeted'
      ? [
          ...new Set(
            formData
              .getAll('target_programmes')
              .filter(
                (value): value is string =>
                  typeof value === 'string' && value.length > 0
              )
          ),
        ]
      : [];

  const semesterValues =
    audienceType === 'targeted'
      ? formData.getAll('target_semesters')
      : [];

  if (
    semesterValues.some(
      (value) =>
        typeof value !== 'string' ||
        !/^[1-9]$/.test(value)
    )
  ) {
    throw new Error('Invalid semester selection');
  }

  const semesters = [
    ...new Set(semesterValues.map((value) => Number(value))),
  ];

  if (
    audienceType === 'targeted' &&
    (programmeIds.length === 0 || semesters.length === 0)
  ) {
    return actionError(
    'Select at least one programme and one semester.'
  );
}

  if (
    typeof announcementId !== 'string' ||
    typeof title !== 'string' ||
    !title.trim()
  ) {
    throw new Error('Invalid announcement data');
  }

  // Verify ownership
  const { data: existing, error: ownershipError } =
    await supabase
      .from('announcements')
      .select('id, is_urgent')
      .eq('id', announcementId)
      .eq('publisher_id', user.id)
      .maybeSingle();

  if (ownershipError || !existing) {
    throw new Error('Announcement not found or access denied');
  }

  // Update announcement
  // together in one database transaction.
  const { error: updateError } = await supabase.rpc(
    'update_announcement_details',
    {
      p_announcement_id: announcementId,
      p_title: title.trim(),
      p_body: body.trim(),
      p_is_urgent: existing.is_urgent,
      p_audience_type: audienceType,
      p_category_ids: categoryIds,
      p_programme_ids: programmeIds,
      p_semesters: semesters,

      // Calendar Integration
      p_event_start: eventStart,
      p_event_end: eventEnd,
      p_event_location: eventLocation || null,
    }
  );

  if (updateError) {
    console.error('UPDATE ANNOUNCEMENT ERROR:', updateError);

    return actionError(
    'We could not save your changes. Please try again.'
  );
}



  } catch (error) {
    console.error('EDIT ANNOUNCEMENT ERROR:', error);

    return actionError(getFriendlyActionError(error));
  }

  // Only revalidate and redirect after the RPC succeeds.
  revalidatePath('/manage');
  revalidatePath('/feed');

  redirect('/manage');
}