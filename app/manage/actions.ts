'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { buildFeedbackUrl } from '@/lib/action-feedback';





export async function deleteAnnouncement(formData: FormData) {
  const announcementId = formData.get('announcement_id');

  if (typeof announcementId !== 'string' || !announcementId) {
    throw new Error('Invalid announcement ID');
  }

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

  // 1. Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('You must be logged in');
  }

  // 2. Verify role
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
    throw new Error('Unauthorized');
  }

  // 3. Verify ownership and retrieve attachment
  const { data: announcement, error: lookupError } = await supabase
    .from('announcements')
    .select('id, attachment_url')
    .eq('id', announcementId)
    .eq('publisher_id', user.id)
    .maybeSingle();

  if (lookupError || !announcement) {
    throw new Error('Announcement not found or access denied');
  }

  // 4. Delete announcement from database
  const { data: deleted, error: deleteError } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId)
    .eq('publisher_id', user.id)
    .select('id');

  if (deleteError) {
    console.error('DELETE ERROR:', deleteError);
    throw new Error(
      `Failed to delete announcement: ${deleteError.message}`
    );
  }

  if (!deleted || deleted.length === 0) {
    throw new Error('No announcement was deleted. Check RLS policies.');
  }

  console.log('DELETED ANNOUNCEMENT:', announcementId);

  // 5. Remove associated attachment from Storage
  if (announcement.attachment_url) {
    const bucketName = 'announcements';

    // Only attempt cleanup for URLs belonging to this bucket.
    const marker = `/storage/v1/object/public/${bucketName}/`;
    const url = new URL(announcement.attachment_url);
    const index = url.pathname.indexOf(marker);

    if (index !== -1) {
      const filePath = decodeURIComponent(
        url.pathname.slice(index + marker.length)
      );

      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (storageError) {
          console.error('ATTACHMENT CLEANUP ERROR:', storageError);
        }
      }
    }
  }

  revalidatePath('/manage');
  revalidatePath('/feed');
}

export async function updateAnnouncementStatus(formData: FormData) {
  const announcementId = formData.get('announcement_id');
  const newStatus = formData.get('status');

  if (
    typeof announcementId !== 'string' ||
    !announcementId ||
    (newStatus !== 'draft' && newStatus !== 'published')
  ) {
    throw new Error('Invalid announcement status request');
  }

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

  // 1. Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // 2. Verify role
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
    throw new Error('Unauthorized');
  }

  // 3. Verify announcement ownership
  const { data: announcement, error: lookupError } = await supabase
    .from('announcements')
    .select('id, status, title, body, audience_type')
    .eq('id', announcementId)
    .eq('publisher_id', user.id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to load announcement: ${lookupError.message}`);
  }

  if (!announcement) {
    throw new Error('Announcement not found or access denied');
  }

  // 4. Prevent publishing incomplete announcements
  if (
    newStatus === 'published' &&
    (!announcement.title?.trim() || !announcement.body?.trim())
  ) {
    throw new Error('Add a title and body before publishing');
  }

  // 4.1 Validate target audience before publishing
  if (
    newStatus === 'published' &&
    announcement.audience_type === 'targeted'
  ) {
    const { data: targets, error: targetsError } = await supabase
      .from('announcement_targets')
      .select(`
        programme_id,
        semester,
        programmes (
          id,
          is_active
        )
      `)
      .eq('announcement_id', announcementId);

    if (targetsError) {
      console.error('TARGET VALIDATION ERROR:', targetsError);

      throw new Error(
        `Failed to validate target audience: ${targetsError.message}`
      );
    }

    if (!targets || targets.length === 0) {
      throw new Error(
        'This announcement has no target audience. Edit it and select at least one programme and semester before publishing.'
      );
    }

    const hasInvalidTarget = targets.some((target) => {
      const relatedProgramme = target.programmes;

      // Handle both possible relationship shapes.
      const programme = Array.isArray(relatedProgramme)
        ? relatedProgramme[0]
        : relatedProgramme;

      const invalidProgramme =
        !programme || programme.is_active !== true;

      const invalidSemester =
        !Number.isInteger(target.semester) ||
        target.semester < 1 ||
        target.semester > 9;

      return invalidProgramme || invalidSemester;
    });

    if (hasInvalidTarget) {
      throw new Error(
        'This announcement contains an invalid or inactive target programme. Please update its target audience before publishing.'
      );
    }
  }

  // 5. Update status
  const { data: updated, error: updateError } = await supabase
    .from('announcements')
    .update({
      status: newStatus,
      published_at:
        newStatus === 'published'
          ? new Date().toISOString()
          : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', announcementId)
    .eq('publisher_id', user.id)
    .eq('status', announcement.status)
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('STATUS UPDATE ERROR:', updateError);

    const message =
      newStatus === 'published'
        ? 'Unable to publish. Please review the target programme and semester selections.'
        : 'Unable to move the announcement to drafts. Please try again.';

    redirect('/manage?error=' + encodeURIComponent(message));
  }

  if (!updated) {
    throw new Error('Announcement was not updated. Please refresh and retry.');
  }

  revalidatePath('/manage');
  revalidatePath('/feed');

  redirect('/manage');
}

type DeleteState = {
  error: string | null;
};

export async function deleteAnnouncementWithFeedback(
  _previousState: DeleteState,
  formData: FormData
): Promise<DeleteState> {
  try {
    await deleteAnnouncement(formData);
  } catch (error) {
    console.error('DELETE ANNOUNCEMENT ERROR:', error);

    let message =
      'Unable to delete this announcement. Please try again.';

    if (error instanceof Error) {
      if (/logged in|unauthorized/i.test(error.message)) {
        message =
          'Your session may have expired. Please sign in again.';
      } else if (
        /not found|access denied/i.test(error.message)
      ) {
        message =
          'This announcement no longer exists or you do not have permission to delete it.';
      } else if (/invalid announcement ID/i.test(error.message)) {
        message =
          'Invalid announcement. Please refresh the page.';
      }
    }

    return { error: message };
  }

  redirect(
    '/manage?success=' +
      encodeURIComponent('Announcement deleted successfully.')
  );
}
