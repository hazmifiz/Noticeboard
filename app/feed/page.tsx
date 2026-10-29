import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentTab = resolvedSearchParams.tab === 'all' ? 'all' : 'personalized';

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch user role & active categories for sidebar
  const [userData, categoriesRes] = await Promise.all([
    supabase.from('users').select('full_name, roles(role_name)').eq('id', user?.id).single(),
    supabase.from('categories').select('*').eq('is_active', true),
  ]);

  // @ts-ignore
  const roleName = userData.data?.roles?.role_name || 'Student';
  const categories = categoriesRes.data || [];

  // Fetch Announcements based on active tab
  let announcements = [];
  if (currentTab === 'personalized' && user) {
    const { data } = await supabase.rpc('get_personalized_feed', { p_user_id: user.id });
    announcements = data || [];
  } else {
    const { data } = await supabase
      .from('announcements')
      .select('*, users:publisher_id(full_name), announcement_categories(categories(name))')
      .order('created_at', { ascending: false });
    announcements = data || [];
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Top App Shell Navbar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/20">
            CAP
          </div>
          <span className="font-bold text-slate-900">Campus Announcement Portal</span>
        </div>

        <div className="flex items-center gap-4">
          {(roleName === 'Publisher' || roleName === 'Admin') && (
            <Link
              href="/create"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-all"
            >
              + Create Post
            </Link>
          )}
          {roleName === 'Admin' && (
            <Link
              href="/admin"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl transition-all"
            >
              Admin Desk
            </Link>
          )}
          <span className="text-xs font-semibold text-slate-600 pl-2 border-l border-slate-200">
            {userData.data?.full_name} ({roleName})
          </span>
        </div>
      </header>

      {/* Main App Layout Grid */}
      <div className="max-w-7xl w-full mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 px-6 py-8 flex-1">
        {/* Left Sidebar: Subscriptions & Navigation */}
        <aside className="space-y-6 md:col-span-1">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Campus Taxonomy</h3>
            <nav className="space-y-1">
              <Link
                href="/feed?tab=personalized"
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold block transition-colors ${currentTab === 'personalized' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                📌 My Personalized Feed
              </Link>
              <Link
                href="/feed?tab=all"
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold block transition-colors ${currentTab === 'all' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                🌐 All Campus Stream
              </Link>
            </nav>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Channels</h3>
            <div className="space-y-2">
              {categories.map((cat: any) => (
                <div key={cat.id} className="flex items-center justify-between text-xs text-slate-600 py-1">
                  <span># {cat.name}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Stream Feed */}
        <main className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-900">
              {currentTab === 'personalized' ? 'Personalized Subscriptions & Urgent Alerts' : 'All Campus Announcements'}
            </h1>
            <span className="text-xs text-slate-400">{announcements.length} posts found</span>
          </div>

          {announcements.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
              No announcements available in this view.
            </div>
          ) : (
            announcements.map((post: any) => (
              <article
                key={post.id}
                className={`p-6 rounded-2xl border transition-all shadow-sm space-y-3 ${
                  post.is_urgent ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    {post.is_urgent && (
                      <span className="font-bold uppercase tracking-wider bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-md">
                        🚨 Urgent Alert
                      </span>
                    )}
                    <span className="font-semibold text-slate-700">{post.users?.full_name || 'Institutional Staff'}</span>
                  </div>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>

                <h2 className="text-lg font-bold text-slate-900">{post.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{post.body}</p>

                {post.attachment_url && (
                  <div className="pt-2">
                    <a
                      href={post.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      📎 View Attachment File
                    </a>
                  </div>
                )}
              </article>
            ))
          )}
        </main>
      </div>
    </div>
  );
}