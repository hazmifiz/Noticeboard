'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

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
export async function updateUserRole(userId: string, newRoleId: string) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  await verifyAdmin(supabase);

  const { error } = await supabase
    .from('users')
    .update({ role_id: newRoleId, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error('Failed to update user role.');
  revalidatePath('/admin');
}

// Action 2: Create a new category taxonomy
export async function createCategory(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  await verifyAdmin(supabase);

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const { error } = await supabase.from('categories').insert({
    name,
    slug,
    description,
    is_active: true,
  });

  if (error) throw new Error('Failed to create category.');
  revalidatePath('/admin');
}

// Action 3: Toggle Category Status (Active/Disabled)
export async function toggleCategoryStatus(categoryId: string, currentStatus: boolean) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  await verifyAdmin(supabase);

  const { error } = await supabase
    .from('categories')
    .update({ is_active: !currentStatus })
    .eq('id', categoryId);

  if (error) throw new Error('Failed to update category status.');
  revalidatePath('/admin');
}