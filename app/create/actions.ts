
'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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



export async function submitAnnouncement(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Initialize Supabase
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

  // 2. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // 3. Retrieve user role ID
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, role_id')
    .eq('id', user.id)
    .maybeSingle();

  console.log('AUTH USER ID:', user.id);
  console.log('USER DATA:', userData);
  console.log('USER ERROR:', userError);

  if (userError || !userData) {
    throw new Error('Unable to retrieve user profile');
  }

  // 4. Retrieve role name separately
  const { data: roleData, error: roleError } = await supabase
    .from('roles')
    .select('role_name')
    .eq('id', userData.role_id)
    .maybeSingle();

  console.log('ROLE DATA:', roleData);
  console.log('ROLE ERROR:', roleError);

  if (roleError || !roleData) {
    throw new Error('Unable to retrieve user role');
  }

  const roleName = roleData.role_name?.trim();

  console.log('FINAL ROLE:', roleName);

  // 5. Authorize MPP and Admin
  if (roleName !== 'MPP' && roleName !== 'Admin') {
    redirect('/feed?error=unauthorized');
  }
  
console.log("CHECKPOINT 1: Role verified");
try {
  // 6. Extract and validate form data
  const title = (formData.get('title') as string)?.trim();

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

  const file = formData.get('attachment');

  const intent = formData.get('intent');

  const audienceType = formData.get('audience_type');


  // Extract optional event information
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

// Both dates must be provided together.
if (
  (eventStartInput && !eventEndInput) ||
  (!eventStartInput && eventEndInput)
) {
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

  if (new Date(eventEnd).getTime() <= new Date(eventStart).getTime()) {
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
  if (audienceType !== 'all' && audienceType !== 'targeted') {
    throw new Error('Invalid target audience');
  }

  let targetProgrammeIds: string[] = [];
  let targetSemesters: number[] = [];

  if (audienceType === 'targeted') {
    targetProgrammeIds = [
      ...new Set(
        formData
          .getAll('target_programmes')
          .filter((value): value is string =>
            typeof value === 'string' && value.length > 0
          )
      ),
    ];

    const rawSemesters = formData.getAll('target_semesters');

    if (
      rawSemesters.some(
        (value) =>
          typeof value !== 'string' ||
          !/^[1-9]$/.test(value)
      )
    ) {
      throw new Error('Invalid semester selection');
    }

    targetSemesters = [
      ...new Set(rawSemesters.map((value) => Number(value))),
    ];

    if (
      targetProgrammeIds.length === 0 ||
      targetSemesters.length === 0
    ) {
      throw new Error(
        'Select at least one programme and semester'
      );
    }

    // Validate programme IDs against the official active list.
    const { data: validProgrammes, error: programmeError } =
      await supabase
        .from('programmes')
        .select('id')
        .in('id', targetProgrammeIds)
        .eq('is_active', true);

    if (
      programmeError ||
      validProgrammes?.length !== targetProgrammeIds.length
    ) {
      throw new Error('Invalid programme selection');
    }
  }

  if (intent !== 'draft' && intent !== 'published') {
    throw new Error('Invalid submission intent');
  }
  
  if (!title) {
    throw new Error('Please enter an announcement title.');
  }

  if (!hasAnnouncementText(body)) {
    throw new Error('Announcement body cannot be empty');
  }

  // 7. Upload optional attachment
  let attachmentUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Unsupported attachment type');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Attachment must be smaller than 10 MB');
    }

    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${crypto.randomUUID()}.${fileExtension}`;

    const { data: uploadData, error: uploadError } =
      await supabase.storage
        .from('announcements')
        .upload(uniqueFileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

    console.log('UPLOAD RESULT:', uploadData);
    console.log('UPLOAD ERROR:', uploadError);

    if (uploadError) {
      throw new Error(
        `Failed to upload attachment: ${uploadError.message}`
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('announcements')
      .getPublicUrl(uniqueFileName);

    attachmentUrl = publicUrlData.publicUrl;
  }

  // IMPORTANT: This is OUTSIDE the attachment if block.
  console.log('CHECKPOINT 3: Inserting announcement');

  // 8. Insert announcement
  const { data: announcement, error: insertError } = await supabase
    .from('announcements')
    .insert({
      title,
      body,
      is_urgent: false,
      publisher_id: user.id,
      attachment_url: attachmentUrl,
      audience_type: audienceType,

      // Calendar Integration
      event_start: eventStart,
      event_end: eventEnd,
      event_location: eventStart ? eventLocation || null : null,

      status: 'draft',
      published_at: null,
    })
    .select('id')
    .single();

  console.log('ANNOUNCEMENT INSERT RESULT:', announcement);
  console.log('ANNOUNCEMENT INSERT ERROR:', insertError);

  if (insertError || !announcement) {
    throw new Error(
      `Failed to create announcement: ${insertError?.message}`
    );
  }

  // 9. Insert announcement category mappings
  if (categoryIds.length > 0) {
    const categoryInserts = categoryIds.map((categoryId) => ({
      announcement_id: announcement.id,
      category_id: categoryId,
    }));

    const { error: categoryError } = await supabase
      .from('announcement_categories')
      .insert(categoryInserts);

    if (categoryError) {
      console.error('CATEGORY INSERT ERROR:', categoryError);
      throw new Error(
        `Failed to assign categories: ${categoryError.message}`
      );
    }
  }

  if (audienceType === 'targeted') {
    const targetRows = targetProgrammeIds.flatMap(
      (programmeId) =>
        targetSemesters.map((semester) => ({
          announcement_id: announcement.id,
          programme_id: programmeId,
          semester,
        }))
    );

    const { error: targetError } = await supabase
      .from('announcement_targets')
      .insert(targetRows);

    if (targetError) {
      console.error('TARGET INSERT ERROR:', targetError);
      throw new Error(
        `Failed to assign target audience: ${targetError.message}`
      );
    }
  }

  if (intent === 'published') {
    const { error: publishError } = await supabase
      .from('announcements')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', announcement.id);

    if (publishError) {
      throw new Error(
        `Failed to publish announcement: ${publishError.message}`
      );
    }
  }
  console.log('CHECKPOINT 5: Publishing completed');


    } catch (error) {
    console.error('CREATE ANNOUNCEMENT ERROR:', error);

    return actionError(getFriendlyActionError(error));
  }

  // Redirect only after a successful submission.
  // Keep this outside try/catch.
  redirect('/feed');
}