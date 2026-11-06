import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  createCategory,
  toggleCategoryStatus,
  changeUserRole,
  moderateAnnouncement,
} from './actions';
import { sanitizeAnnouncementHtml } from '@/lib/announcement-html';
import FormFeedback from '@/components/FormFeedback';
import {
  createCategoryWithFeedback,
  toggleCategoryWithFeedback,
  changeUserRoleWithFeedback,
  // Keep your other Admin actions.
} from './actions';



export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    error?: string;
    search?: string;
    success?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentTab = resolvedSearchParams.tab || 'taxonomy';

  const searchTerm =
  resolvedSearchParams.search?.trim() || '';

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify user is actually an Admin
  const { data: userData } = await supabase
    .from('users')
    .select('roles(role_name)')
    .eq('id', user.id)
    .single();

  // @ts-ignore
  const roleName = userData?.roles?.role_name || 'Student';
  if (roleName !== 'Admin') {
    redirect('/feed'); // Bounce non-admins back to feed
  }

  // Fetch real statistics and categories concurrently
  const [usersCountRes, categoriesRes, postsCountRes] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('categories').select('*').order('name', { ascending: true }),
    supabase
  .from('announcements')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'published'),
  ]);


  // Load users and roles only when the User Management tab is open.
  const [usersListRes, rolesListRes] =
    currentTab === 'users'
      ? await Promise.all([
          supabase
            .from('users')
            .select('id, full_name, email, role_id')
            .order('full_name', { ascending: true }),

          supabase
            .from('roles')
            .select('id, role_name')
            .in('role_name', ['Student', 'MPP', 'Admin']),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (usersListRes.error) {
    throw new Error(
      `Failed to load users: ${usersListRes.error.message}`
    );
  }

  if (rolesListRes.error) {
    throw new Error(
      `Failed to load roles: ${rolesListRes.error.message}`
    );
  }

  const managedUsers = usersListRes.data ?? [];
  const availableRoles = rolesListRes.data ?? [];

  const roleNames = new Map(
    availableRoles.map((role) => [role.id, role.role_name])
  );

  // Retrieve all announcements for Admin moderation.
  let moderationQuery = supabase
    .from('announcements')
    .select(`
      id,
      title,
      body,
      status,
      is_urgent,
      audience_type,
      created_at,
      publisher_id,
      users:publisher_id (
        full_name,
        email
      )
    `);

  // Apply search only within the moderation tab.
  if (currentTab === 'moderation' && searchTerm) {
    const safeSearchTerm = searchTerm
      .replace(/[%_,().]/g, ' ')
      .trim();

    if (safeSearchTerm) {
      moderationQuery = moderationQuery.or(
        `title.ilike.%${safeSearchTerm}%,body.ilike.%${safeSearchTerm}%`
      );
    }
  }

const { data: moderationPosts, error: moderationError } =
  currentTab === 'moderation'
    ? await moderationQuery.order('created_at', {
        ascending: false,
      })
    : { data: [], error: null };

if (moderationError) {
  console.error('MODERATION LOAD ERROR:', moderationError);
  throw new Error('Failed to load announcements for moderation');
}

const allModerationPosts = moderationPosts ?? [];

  const totalUsers = usersCountRes.count || 0;
  const categories = categoriesRes.data || [];
  const totalPosts = postsCountRes.count || 0;
  const activeCategoriesCount = categories.filter((c) => c.is_active).length;

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white border-b border-slate-800 h-16 flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold">CAN</div>
          <span className="font-bold text-lg">Admin Governance Desk</span>
        </div>
        <Link href="/feed" className="text-xs text-slate-400 hover:text-white transition-colors">
          Exit Admin &rarr;
        </Link>
      </header>

      <main className="max-w-6xl w-full mx-auto px-6 py-8 flex-1 space-y-6">
        {/* Stat Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-400 font-semibold uppercase">Total Users</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalUsers}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-400 font-semibold uppercase">Active Categories</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{activeCategoriesCount}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-400 font-semibold uppercase">Total Posts Published</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalPosts}</div>
          </div>
        </div>

        {/* Admin action feedback */}
        {resolvedSearchParams.success && (
          <FormFeedback
            type="success"
            message={resolvedSearchParams.success}
          />
        )}

        {resolvedSearchParams.error && (
          <FormFeedback
            type="error"
            message={resolvedSearchParams.error}
          />
        )}

        {/* Admin Tabs & Content Panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-6 pt-4 flex gap-6 text-sm font-semibold">
            <Link
              href="/admin?tab=taxonomy"
              className={`pb-3 border-b-2 transition-colors ${currentTab === 'taxonomy' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Taxonomy Management
            </Link>
            <Link
              href="/admin?tab=moderation"
              className={`pb-3 border-b-2 transition-colors ${currentTab === 'moderation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Content Moderation Queue
            </Link>
            <Link
              href="/admin?tab=users"
              className={`pb-3 border-b-2 transition-colors ${currentTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              User Management
            </Link>
          </div>

          <div className="p-6 space-y-6">
            {currentTab === 'taxonomy' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-slate-900">Active Campus Categories</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Manage official topic channels available to students and publishers.</p>
                  </div>
                </div>

                {/* Add Category Form */}
                <form
                  action={createCategoryWithFeedback}
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="category_name"
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Category Name
                      </label>

                      <input
                        id="category_name"
                        type="text"
                        name="name"
                        required
                        maxLength={100}
                        placeholder="E.g., Student Welfare"
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="category_description"
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Description (Optional)
                      </label>

                      <input
                        id="category_description"
                        type="text"
                        name="description"
                        maxLength={250}
                        placeholder="E.g., Student support announcements"
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    + Add Category
                  </button>
                </form>

                {/* Data Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase bg-slate-50">
                        <th className="py-3 px-4">Category Name</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {categories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-semibold text-slate-800"># {cat.name}</td>
                          <td className="py-3.5 px-4">
                            {cat.is_active ? (
                              <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded">Active</span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded">Disabled</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <form
                              action={toggleCategoryWithFeedback.bind(null, cat.id)}
                            >
                              <button
                                type="submit"
                                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                                  cat.is_active
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                                }`}
                              >
                                {cat.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {currentTab === 'moderation' && (
              <div className="space-y-5">
                {/* Heading */}
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Content Moderation
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Review campus announcements, control publication
                    status, and manage urgent alerts.
                  </p>
                </div>

                {/* Moderation Search */}
                  <form
                    action="/admin"
                    method="GET"
                    className="flex flex-wrap items-center gap-3"
                  >
                    <input
                      type="hidden"
                      name="tab"
                      value="moderation"
                    />

                    <input
                      type="search"
                      name="search"
                      defaultValue={searchTerm}
                      placeholder="Search announcements..."
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Search
                    </button>

                    {searchTerm && (
                      <Link
                        href="/admin?tab=moderation"
                        className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Clear
                      </Link>
                    )}
                  </form>

                {/* Moderation feedback */}
                {resolvedSearchParams.error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  >
                    {resolvedSearchParams.error}
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  {searchTerm
                    ? `${allModerationPosts.length} result(s) found for "${searchTerm}"`
                    : `${allModerationPosts.length} announcements`}
                </p>

                {/* Moderation table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Announcement</th>
                        <th className="px-4 py-3">Publisher</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Urgency</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {allModerationPosts.map((post) => (
                        <tr key={post.id} className="hover:bg-slate-50">

              {/* Announcement details */}
              <td className="px-4 py-4 align-top">
                <p className="max-w-xs font-semibold text-slate-900">
                  {post.title}
                </p>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-blue-600 hover:underline">
                    Review Content
                  </summary>

                  <div
                    className="announcement-content mt-3 max-h-64 max-w-sm overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeAnnouncementHtml(post.body ?? ''),
                    }}
                  />
                </details>

                <p className="mt-1 text-xs text-slate-500">
                  {new Date(post.created_at).toLocaleDateString(
                    'en-MY',
                    {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    }
                  )}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Audience:{' '}
                  {post.audience_type === 'targeted'
                    ? 'Targeted'
                    : 'All Students'}
                </p>
              </td>

              {/* Publisher */}
              <td className="px-4 py-4 align-top">
                <p className="font-medium text-slate-800">
                  {post.users?.full_name || 'Unknown Publisher'}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {post.users?.email || ''}
                </p>
              </td>

              {/* Publication status */}
              <td className="px-4 py-4 align-top">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    post.status === 'published'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {post.status === 'published'
                    ? 'Published'
                    : 'Draft'}
                </span>
              </td>

              {/* Urgency status */}
              <td className="px-4 py-4 align-top">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    post.is_urgent
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {post.is_urgent ? 'Urgent' : 'Normal'}
                </span>
              </td>

              {/* Moderation actions */}
              <td className="px-4 py-4 align-top">
                <div className="flex justify-end gap-2">
                  {/* Publish / Unpublish */}
                  <form action={moderateAnnouncement}>
                    <input
                      type="hidden"
                      name="announcement_id"
                      value={post.id}
                    />

                    <input
                      type="hidden"
                      name="moderation_action"
                      value={
                        post.status === 'published'
                          ? 'unpublish'
                          : 'publish'
                      }
                    />

                    <input
                      type="hidden"
                      name="search"
                      value={searchTerm}
                    />

                    <button
                      type="submit"
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        post.status === 'published'
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      {post.status === 'published'
                        ? 'Unpublish'
                        : 'Publish'}
                    </button>
                  </form>

                  {/* Toggle Urgent */}
                  <form action={moderateAnnouncement}>
                    <input
                      type="hidden"
                      name="announcement_id"
                      value={post.id}
                    />

                    <input
                      type="hidden"
                      name="moderation_action"
                      value="toggle_urgent"
                    />

                    <input
                      type="hidden"
                      name="search"
                      value={searchTerm}
                    />

                    <button
                      type="submit"
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        post.is_urgent
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      {post.is_urgent
                        ? 'Remove Urgent'
                        : 'Mark Urgent'}
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {allModerationPosts.length === 0 && (
        <div className="p-10 text-center">
          <p className="font-semibold text-slate-700">
            No announcements found
          </p>

          <p className="mt-1 text-sm text-slate-500">
            There are currently no announcements to moderate.
          </p>
        </div>
      )}
    </div>
  </div>
)}

            {currentTab === 'users' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    User Management
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    View registered users and manage their roles.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Current Role</th>
                        <th className="px-4 py-3">Change Role</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {managedUsers.map((account) => {
                        const currentRole =
                          roleNames.get(account.role_id) ?? 'Unknown';

                        const isCurrentAdmin = account.id === user.id;

                        return (
                          <tr key={account.id} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <p className="font-semibold text-slate-900">
                                {account.full_name || 'Unnamed User'}
                              </p>

                              <p className="text-xs text-slate-500">
                                {account.email}
                              </p>

                              {isCurrentAdmin && (
                                <p className="mt-1 text-xs font-semibold text-blue-600">
                                  Your account
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  currentRole === 'Admin'
                                    ? 'bg-purple-100 text-purple-700'
                                    : currentRole === 'MPP'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {currentRole}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              {isCurrentAdmin ? (
                                <span className="text-xs text-slate-400">
                                  Protected account
                                </span>
                              ) : (
                                <form
                                  action={changeUserRoleWithFeedback.bind(null, account.id)}
                                  className="flex items-center gap-2"
                                >
                                  <select
                                    name="role_id"
                                    defaultValue={account.role_id}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                                  >
                                    {availableRoles.map((role) => (
                                      <option key={role.id} value={role.id}>
                                        {role.role_name}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    type="submit"
                                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                                  >
                                    Save
                                  </button>
                                </form>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {managedUsers.length === 0 && (
                    <p className="p-8 text-center text-sm text-slate-500">
                      No registered users found.
                    </p>
                  )}
                </div>

                <p className="text-xs text-slate-500">
                  Role changes affect application permissions.
                  Admins cannot change their own roles.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}