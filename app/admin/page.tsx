import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  // Fetch metrics and management data concurrently
  const [
    { count: userCount },
    { count: postCount },
    { data: categories },
    { data: users },
    { data: roles }
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('announcements').select('*', { count: 'exact', head: true }),
    supabase.from('categories').select('*').order('created_at', { ascending: false }),
    supabase.from('users').select('id, full_name, email, roles(id, role_name)').order('created_at', { ascending: false }),
    supabase.from('roles').select('id, role_name')
  ]);

  return (
    <AdminDashboardClient
      initialUserCount={userCount || 0}
      initialPostCount={postCount || 0}
      initialCategories={categories || []}
      initialUsers={users || []}
      roles={roles || []}
    />
  );
}