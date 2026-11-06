import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { updateAnnouncement } from './actions';
import RichTextEditor from '@/components/RichTextEditor';
import TargetAudienceSelector from '@/components/TargetAudienceSelector';
import AnnouncementForm from '@/components/AnnouncementForm';

function toMalaysiaDateTimeLocal(value: string | null): string {
  if (!value) return '';

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(new Date(value));

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return (
    `${getPart('year')}-${getPart('month')}-${getPart('day')}` +
    `T${getPart('hour')}:${getPart('minute')}`
  );
}

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
            // Session refresh handled by proxy.ts
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check publisher role
  const { data: userData } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .single();

  const { data: roleData } = await supabase
    .from('roles')
    .select('role_name')
    .eq('id', userData?.role_id)
    .single();

  const roleName = roleData?.role_name?.trim();

  if (roleName !== 'MPP' && roleName !== 'Admin') {
    redirect('/feed?error=unauthorized');
  }

  // Retrieve announcement
  const { data: announcement, error } = await supabase
    .from('announcements')
    .select(`
        id,
        title,
        body,
        status,
        audience_type,
        is_urgent,
        attachment_url,
        publisher_id,
        event_start,
        event_end,
        event_location,
        announcement_categories(category_id)
    `)
    .eq('id', id)
    .eq('publisher_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('LOAD ANNOUNCEMENT ERROR:', error);
    throw new Error('Failed to load announcement');
  }

  if (!announcement) notFound();

  const { data: programmes, error: programmesError } = await supabase
    .from('programmes')
    .select('id, code, name')
    .eq('is_active', true)
    .order('code', { ascending: true });

    if (programmesError) {
    throw new Error('Failed to load programmes');
    }

    const { data: existingTargets, error: targetsError } = await supabase
    .from('announcement_targets')
    .select('programme_id, semester')
    .eq('announcement_id', announcement.id);

    if (targetsError) {
    throw new Error('Failed to load target audience');
    }

    const initialProgrammeIds = [
    ...new Set(
        (existingTargets ?? []).map((target) => target.programme_id)
    ),
    ];

    const initialSemesters = [
    ...new Set(
        (existingTargets ?? []).map((target) => target.semester)
    ),
    ];

  // Retrieve active categories
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true);

  const selectedCategoryIds = new Set(
    announcement.announcement_categories?.map(
      (item) => item.category_id
    ) || []
  );

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/manage"
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          ← Back to Management
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Edit Announcement
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Update your announcement details.
          </p>

          <AnnouncementForm
            action={updateAnnouncement}
            className="mt-6 space-y-6"
            >
            <input
              type="hidden"
              name="announcement_id"
              value={announcement.id}
            />

            {/* Title */}
            <div className="space-y-2">
              <label
                htmlFor="title"
                className="block text-sm font-semibold text-slate-700"
              >
                Headline
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                defaultValue={announcement.title}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                    Announcement Body
                </label>

                <RichTextEditor
                    name="body"
                    initialContent={announcement.body ?? ''}
                />
            </div>

            {/* Categories */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                Target Channels
              </p>

              <div className="grid grid-cols-2 gap-3">
                {categories?.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      name="categories"
                      value={category.id}
                      defaultChecked={selectedCategoryIds.has(category.id)}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>

            <TargetAudienceSelector
                programmes={programmes ?? []}
                initialAudienceType={
                    announcement.audience_type === 'targeted'
                    ? 'targeted'
                    : 'all'
                }
                initialProgrammeIds={initialProgrammeIds}
                initialSemesters={initialSemesters}
                />

                {/* Event Information */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div>
                <h2 className="text-sm font-semibold text-slate-800">
                Event Information
                <span className="ml-2 font-normal text-slate-400">
                    (Optional)
                </span>
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                Add or update event details. Students can export
                scheduled events to their calendars.
                </p>
            </div>

            {/* Event Start */}
            <div className="space-y-2">
                <label
                htmlFor="event_start"
                className="block text-sm font-semibold text-slate-700"
                >
                Event Start
                </label>

                <input
                type="datetime-local"
                id="event_start"
                name="event_start"
                defaultValue={toMalaysiaDateTimeLocal(
                    announcement.event_start
                )}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Event End */}
            <div className="space-y-2">
                <label
                htmlFor="event_end"
                className="block text-sm font-semibold text-slate-700"
                >
                Event End
                </label>

                <input
                type="datetime-local"
                id="event_end"
                name="event_end"
                defaultValue={toMalaysiaDateTimeLocal(
                    announcement.event_end
                )}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Event Location */}
            <div className="space-y-2">
                <label
                htmlFor="event_location"
                className="block text-sm font-semibold text-slate-700"
                    >
                    Event Location
                    </label>

                    <input
                    type="text"
                    id="event_location"
                    name="event_location"
                    maxLength={200}
                    defaultValue={announcement.event_location ?? ''}
                    placeholder="E.g., Main Lecture Hall"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <p className="text-xs text-slate-500">
                    Times are in Malaysia Time (MYT, UTC+8).
                    Clear both dates and the location to remove
                    event information from this announcement.
                </p>
                </div>



            {/* Existing attachment */}
            {announcement.attachment_url && (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Current Attachment
                </p>
                <a
                  href={announcement.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View Existing Attachment ↗
                </a>
                <p className="mt-2 text-xs text-slate-500">
                  The existing attachment will be kept.
                </p>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"
            >
              Save Changes
            </button>
          </AnnouncementForm>
        </div>
      </div>
    </div>
  );
}