'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { buildFeedbackUrl } from '@/lib/action-feedback';


// Helper to verify Admin role
async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: userData } = await supabase
    .from('users')
    .select('roles(role_name)')
    .eq('id', user.id)
    .single();

  // @ts-ignore
  if (userData?.roles?.role_name !== 'Admin') {
    throw new Error('Forbidden: Admin access required.');
  }
  return user;
}

// Action 1: Promote or change a user's role
export async function updateUserRole(
  userId: string,
  newRoleId: string
) {
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

  const admin = await verifyAdmin(supabase);

  if (!userId || !newRoleId) {
    throw new Error('Invalid role update request');
  }

  if (userId === admin.id) {
    throw new Error('You cannot change your own role');
  }

  const { error } = await supabase.rpc(
    'admin_set_user_role',
    {
      p_user_id: userId,
      p_role_id: newRoleId,
    }
  );

  if (error) {
    console.error('UPDATE USER ROLE ERROR:', error);

    throw new Error(
      `Failed to update user role: ${error.message}`
    );
  }

  revalidatePath('/admin');
  revalidatePath('/feed');
  revalidatePath('/manage');
}

  // Form-friendly wrapper for the Admin Dashboard.
  export async function changeUserRole(
    userId: string,
    formData: FormData
  ) {
    const roleId = formData.get('role_id');

    if (typeof roleId !== 'string' || !roleId) {
      throw new Error('Please select a valid role');
    }

    await updateUserRole(userId, roleId);
  }

// Action 2: Create a new category taxonomy
export async function createCategory(formData: FormData) {
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

  await verifyAdmin(supabase);

  const rawName = formData.get('name');
  const rawDescription = formData.get('description');

  if (typeof rawName !== 'string') {
    throw new Error('Invalid category name');
  }

  const name = rawName.trim();

  const description =
    typeof rawDescription === 'string'
      ? rawDescription.trim()
      : '';

  if (!name || name.length > 100) {
    throw new Error(
      'Category name must be between 1 and 100 characters'
    );
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug) {
    throw new Error(
      'Category name must contain letters or numbers'
    );
  }

  // Check for existing category with the same slug.
  const { data: existing, error: lookupError } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Failed to check categories: ${lookupError.message}`
    );
  }

  if (existing) {
    throw new Error(
      'A category with this name already exists'
    );
  }

  const { error } = await supabase
    .from('categories')
    .insert({
      name,
      slug,
      description,
      is_active: true,
    });

  if (error) {
    console.error('CREATE CATEGORY ERROR:', error);
    throw new Error(`Failed to create category: ${error.message}`);
  }

  revalidatePath('/admin');
  revalidatePath('/feed');
  revalidatePath('/create');
}

// Action 3: Toggle Category Status (Active/Disabled)
export async function toggleCategoryStatus(
  categoryId: string
) {
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

  await verifyAdmin(supabase);

  // Retrieve current category status from the database.
  const { data: category, error: lookupError } = await supabase
    .from('categories')
    .select('id, is_active')
    .eq('id', categoryId)
    .maybeSingle();

  if (lookupError || !category) {
    throw new Error('Category not found');
  }

  const { data: updated, error: updateError } = await supabase
    .from('categories')
    .update({
      is_active: !category.is_active,
    })
    .eq('id', categoryId)
    .eq('is_active', category.is_active)
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('CATEGORY UPDATE ERROR:', updateError);
    throw new Error(
      `Failed to update category: ${updateError.message}`
    );
  }

  if (!updated) {
    throw new Error(
      'Category status changed. Refresh and try again.'
    );
  }

  revalidatePath('/admin');
  revalidatePath('/feed');
  revalidatePath('/create');
}

export async function moderateAnnouncement(
  formData: FormData
) {
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

  // Verify the current user is an Admin.
  await verifyAdmin(supabase);

  const announcementId = formData.get('announcement_id');
  const action = formData.get('moderation_action');

  const rawSearchTerm = formData.get('search');

  const searchTerm =
    typeof rawSearchTerm === 'string'
      ? rawSearchTerm.trim().slice(0, 100)
      : '';

  const returnParams = new URLSearchParams({
    tab: 'moderation',
  });

  if (searchTerm) {
    returnParams.set('search', searchTerm);
  }

  if (
    typeof announcementId !== 'string' ||
    typeof action !== 'string' ||
    ![
      'publish',
      'unpublish',
      'toggle_urgent',
    ].includes(action)
  ) {
    throw new Error('Invalid moderation request');
  }

  const { error } = await supabase.rpc(
    'admin_moderate_announcement',
    {
      p_announcement_id: announcementId,
      p_action: action,
    }
  );

  if (error) {
    console.error('MODERATION ERROR:', error);

    // Display a friendly error message on the Admin page.
    const message =
      error.message.includes('no valid audience') ||
      error.message.includes('invalid targets')
        ? 'Invalid target audience. Update the announcement targets before publishing.'
        : error.message.includes('title and body')
          ? 'Announcement requires a title and body before publishing.'
          : 'Unable to moderate this announcement. Please try again.';

    returnParams.set('error', message);

    redirect(`/admin?${returnParams.toString()}`);
  }

  revalidatePath('/admin');
  revalidatePath('/feed');
  revalidatePath('/manage');

  const successMessages: Record<string, string> = {
    publish: 'Announcement published successfully.',
    unpublish: 'Announcement unpublished successfully.',
    toggle_urgent: 'Announcement urgency updated successfully.',
  };

  returnParams.set(
    'success',
    successMessages[action] ?? 'Announcement updated successfully.'
  );

  redirect(`/admin?${returnParams.toString()}`);
}

export async function createCategoryWithFeedback(
  formData: FormData
) {
  let feedbackUrl: string;

  try {
    await createCategory(formData);

    feedbackUrl = buildFeedbackUrl(
      '/admin',
      'success',
      'Category created successfully.',
      { tab: 'taxonomy' }
    );
  } catch (error) {
    console.error('CREATE CATEGORY ERROR:', error);

    const message =
      error instanceof Error &&
      /already exists|duplicate/i.test(error.message)
        ? 'A category with this name already exists.'
        : error instanceof Error &&
            /category name|invalid category/i.test(error.message)
          ? 'Please enter a valid category name.'
          : 'Unable to create category. Please try again.';

    feedbackUrl = buildFeedbackUrl(
      '/admin',
      'error',
      message,
      { tab: 'taxonomy' }
    );
  }

  redirect(feedbackUrl);
}

export async function toggleCategoryWithFeedback(
  categoryId: string
) {
  let feedbackUrl: string;

  try {
    await toggleCategoryStatus(categoryId);

    feedbackUrl = buildFeedbackUrl(
      '/admin',
      'success',
      'Category status updated successfully.',
      { tab: 'taxonomy' }
    );
  } catch (error) {
    console.error('TOGGLE CATEGORY ERROR:', error);

    feedbackUrl = buildFeedbackUrl(
      '/admin',
      'error',
      'Unable to update category status. Please try again.',
      { tab: 'taxonomy' }
    );
  }

  redirect(feedbackUrl);
}

export async function changeUserRoleWithFeedback(
  userId: string,
  formData: FormData
) {
  const roleId = formData.get('role_id');
  let feedbackUrl: string;

  if (typeof roleId !== 'string' || !roleId) {
    feedbackUrl = buildFeedbackUrl(
      '/admin',
      'error',
      'Please select a valid user role.',
      { tab: 'users' }
    );
  } else {
    try {
      await updateUserRole(userId, roleId);

      feedbackUrl = buildFeedbackUrl(
        '/admin',
        'success',
        'User role updated successfully.',
        { tab: 'users' }
      );
    } catch (error) {
      console.error('CHANGE USER ROLE ERROR:', error);

      const message =
        error instanceof Error &&
        /own role|own account/i.test(error.message)
          ? 'You cannot change your own Admin role.'
          : 'Unable to change this user role. Please try again.';

      feedbackUrl = buildFeedbackUrl(
        '/admin',
        'error',
        message,
        { tab: 'users' }
      );
    }
  }

  redirect(feedbackUrl);
}