import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AnnouncementCard from '@/components/AnnouncementCard';
import { revalidatePath } from 'next/cache';
import FormFeedback from '@/components/FormFeedback';
import SubscriptionSaveButton from '@/components/SubscriptionSaveButton';


// 1. Server Action for updating subscriptions moved directly into the Feed page
async function updateSubscriptions(formData: FormData) {
  'use server';

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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  let feedbackUrl: string;

  try {
    const rawIds = formData.getAll('categories');

    if (
      rawIds.some(
        (id) =>
          typeof id !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      )
    ) {
      throw new Error('Invalid category selection');
    }

    const categoryIds = [
      ...new Set(rawIds as string[]),
    ];

    const { error } = await supabase.rpc(
      'save_my_subscriptions',
      {
        p_category_ids: categoryIds,
      }
    );

    if (error) {
      console.error('SUBSCRIPTION SAVE ERROR:', error);
      throw new Error('Subscription update failed');
    }

    revalidatePath('/feed');

    feedbackUrl =
      '/feed?success=' +
      encodeURIComponent(
        'Your subscription preferences have been saved.'
      );
  } catch (error) {
    console.error('UPDATE SUBSCRIPTIONS ERROR:', error);

    feedbackUrl =
      '/feed?modal=subscriptions&error=' +
      encodeURIComponent(
        'Unable to save your preferences. Please try again.'
      );
  }

  redirect(feedbackUrl);
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    modal?: string;
    search?: string;
    success?: string;
    error?: string;
}>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentTab = resolvedSearchParams.tab || 'personalized';
  const showModal = resolvedSearchParams.modal === 'subscriptions';
  const searchTerm = resolvedSearchParams.search?.trim() || '';

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [userRes, roleRes, categoriesRes, profileRes, subsRes] = await Promise.all([
    supabase.from('users').select('full_name, role_id').eq('id', user.id).single(),
    supabase.from('users').select('roles(role_name)').eq('id', user.id).single(),
    supabase.from('categories').select('*').eq('is_active', true),
    supabase.from('student_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_subscriptions').select('category_id').eq('user_id', user.id),
  ]);

  if (!profileRes.data) {
    redirect('/onboarding');
  }

  const relatedRole = roleRes.data?.roles;
  const role = Array.isArray(relatedRole) ? relatedRole[0] : relatedRole;
  let roleName = role?.role_name?.trim() || 'Student';
  if (userRes.data?.role_id && roleName === 'Student') {
    const { data: rData } = await supabase.from('roles').select('role_name').eq('id', userRes.data.role_id).single();
    if (rData?.role_name) roleName = rData.role_name.trim();
  }

  const categories = categoriesRes.data || [];
  const subscribedCatIds = new Set(subsRes.data?.map((s) => s.category_id) || []);
  const subscribedCategories = categories.filter((category) => subscribedCatIds.has(category.id));
  const canViewSubscriptions = roleName === 'Student' || roleName === 'MPP';
  if (subsRes.error) {
    console.error(
      'LOAD SUBSCRIPTIONS ERROR:',
      subsRes.error
    );

    throw new Error(
      'Unable to load subscription preferences'
    );

  }
  let announcementsQuery = supabase
    .from('announcements')
    .select(`
      id,
      title,
      body,
      status,
      is_urgent,
      created_at,
      attachment_url,
      event_start,
      event_end,
      event_location,
      users:publisher_id (full_name),
      announcement_categories (
        categories (id, name)
      )
    `)
    .eq('status', 'published')
    .order('is_urgent', { ascending: false })
    .order('created_at', { ascending: false });

  if (searchTerm) {
    const safeSearchTerm = searchTerm
      .replace(/[%_,().]/g, ' ')
      .trim();

    if (safeSearchTerm) {
      announcementsQuery = announcementsQuery.or(
        `title.ilike.%${safeSearchTerm}%,body.ilike.%${safeSearchTerm}%`
      );
    }
  }

  if (currentTab === 'personalized') {
    if (subscribedCatIds.size === 0) {
    // With no subscriptions, show urgent announcements only.
      announcementsQuery = announcementsQuery.eq(
        'is_urgent',
        true
      );
    } else {
    const catIdArray = Array.from(subscribedCatIds);
    const {
      data: matchedRelations,
      error: relationsError,
    } = await supabase
      .from('announcement_categories')
      .select('announcement_id')
      .in('category_id', catIdArray);

      if (relationsError) {
      console.error(
        'SUBSCRIPTION FILTER ERROR:',
        relationsError
      );

      throw new Error('Unable to load your personalized feed.');
    }

    const subscribedAnnouncementIds = [
      ...new Set(
        (matchedRelations ?? []).map(
          (r) => r.announcement_id
        )
      ),
    ];
    
    // Show subscribed announcements OR urgent announcements.
    if (subscribedAnnouncementIds.length > 0) {
      announcementsQuery = announcementsQuery.or(
        `id.in.(${subscribedAnnouncementIds.join(',')}),is_urgent.eq.true`
      );
    } else {
      // No matching posts: still show urgent announcements.
      announcementsQuery = announcementsQuery.eq(
        'is_urgent',
        true
      );
    }
  }
}


  const { data: announcementsData } = await announcementsQuery;
  const announcements = announcementsData || [];

  const fullName = userRes.data?.full_name || user.email?.split('@')[0] || 'User';
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen flex flex-col relative">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 h-16 sticky top-0 z-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold shadow-md shadow-blue-500/20">CAN</div>
          <span className="font-bold text-lg text-slate-800">Campus Noticeboard</span>
        </div>

        <div className="max-w-md w-full mx-4 hidden md:block">
          <form action="/feed" method="GET">
            <input type="hidden" name="tab" value={currentTab} />

            <input
              type="search"
              name="search"
              defaultValue={searchTerm}
              placeholder="Search announcements..."
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </form>
        </div>

        <div className="flex items-center gap-3">
          {roleName === 'MPP'&& (
            <>
              <Link
                href="/manage"
                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Manage Posts
              </Link>

              <Link
                href="/create"
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Create Post
              </Link>
            </>
          )}
          {roleName === 'Admin' && (
            <Link href="/admin" className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition-all">
              Admin
            </Link>
          )}
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center text-xs border border-blue-200" title={fullName}>
            {initials}
          </div>
        </div>
      </header>


      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-6 py-6">
            <FormFeedback
            type="success"
            message={resolvedSearchParams.success}
          />
          <div className="flex border-b border-slate-200 gap-6">
            <Link
              href={`/feed?tab=personalized&search=${encodeURIComponent(searchTerm)}`}
              className={`pb-3 border-b-2 font-semibold text-sm transition-colors ${currentTab === 'personalized' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              My Feed
            </Link>
            <Link
              href={`/feed?tab=all&search=${encodeURIComponent(searchTerm)}`}
              className={`pb-3 border-b-2 font-semibold text-sm transition-colors ${currentTab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              All Campus
            </Link>
          </div>

          {canViewSubscriptions && (
            <section aria-labelledby="subscribed-topics" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <h2 id="subscribed-topics" className="text-sm font-semibold text-slate-900">
                Your subscribed topics
              </h2>
              {subscribedCategories.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {subscribedCategories.map((category) => (
                    <li key={category.id} className="max-w-full break-words rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      # {category.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">You haven’t subscribed to any active topics yet.</p>
              )}
              <Link
                href={{ pathname: '/feed', query: { tab: currentTab, search: searchTerm, modal: 'subscriptions' } }}
                className="block w-full rounded-full bg-blue-50 px-4 py-2 text-center text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                Manage All Topics
              </Link>
            </section>
          )}

          {announcements.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <h3 className="font-semibold text-slate-800">
                No announcements in your feed
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {currentTab === 'personalized' && subscribedCatIds.size === 0
                  ? 'Subscribe to some topics to personalize your feed. Urgent announcements will appear here automatically.'
                  : 'No announcements match your current selection.'}
              </p>
            </div>
          ) : (
            announcements.map((post) => (
              <AnnouncementCard key={post.id} post={post} />
            ))
          )}
        </main>

      {/* Subscription Popup Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Manage Subscriptions</h2>
              
              <Link
                href={{ pathname: '/feed', query: { tab: currentTab, search: searchTerm } }}
                aria-label="Close subscription settings"
                className="text-slate-400 hover:text-slate-600 text-2xl font-light leading-none"
              >
                &times;
              </Link>
            </div>
            
            <form action={updateSubscriptions} className="flex flex-col overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-3 bg-slate-50">
                {categories.map((cat) => {
                  const isChecked = subscribedCatIds.has(cat.id);
                  return (
                    
                    <label key={cat.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-slate-300 transition-all">
                      <div>
                        <span className="block text-sm font-bold text-slate-900"># {cat.name}</span>
                      </div>
                      {resolvedSearchParams.error && (
                        <div className="px-5 pt-4">
                          <FormFeedback
                            type="error"
                            message={resolvedSearchParams.error}
                          />
                        </div>
                      )}
                      <input
                        type="checkbox"
                        name="categories"
                        value={cat.id}
                        defaultChecked={isChecked}
                        className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                    </label>
                  );
                })}
              </div>
              <div className="p-5 border-t border-slate-100 bg-white">
                <SubscriptionSaveButton />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
