import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { submitAnnouncement } from './actions';
import RichTextEditor from '@/components/RichTextEditor';
import TargetAudienceSelector from '@/components/TargetAudienceSelector';
import AnnouncementForm from '@/components/AnnouncementForm';


export default async function CreatePostPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  // 1. Authenticate user
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // 2. Fetch user's role_id
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .single();

  console.log("AUTH USER:", user.id);
  console.log("USER DATA:", userData);
  console.log("USER ERROR:", userError);

  if (userError || !userData) {
    throw new Error("Unable to retrieve user profile");
  }

  const { data: roleData, error: roleError } = await supabase
    .from('roles')
    .select('role_name')
    .eq('id', userData.role_id)
    .single();

  console.log("ROLE DATA:", roleData);
  console.log("ROLE ERROR:", roleError);

  const roleName = roleData?.role_name?.trim() || "";

  console.log("FINAL ROLE:", roleName);

  console.log("AUTH USER:", user.id);
  console.log("USER DATA:", userData);
  console.log("ROLE DATA:", roleData);
  console.log("ROLE NAME:", JSON.stringify(roleName));

  if (roleName !== 'MPP' && roleName !== 'Admin') {
    redirect('/feed');
  }

  // 3. Fetch active categories for the checkboxes
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true);

  const { data: programmes, error: programmesError } = await supabase
  .from('programmes')
  .select('id, code, name')
  .eq('is_active', true)
  .order('code', { ascending: true });

  if (programmesError) {
    console.error('PROGRAMMES ERROR:', programmesError);
    throw new Error('Failed to load programmes');
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/feed" className="text-sm font-semibold text-blue-600 hover:underline">
          &larr; Back to Feed
        </Link>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Create Announcement</h1>
            <p className="text-sm text-slate-500">Publish news, alerts, and updates to the campus.</p>
          </div>

          <AnnouncementForm
              action={submitAnnouncement}
              className="space-y-6"
            >
            {/* Title */}
            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-semibold text-slate-700">Headline</label>
              <input
                type="text"
                name="title"
                id="title"
                required
                className="text-slate-500 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="E.g., Library hours extended for finals week"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                Announcement Body
              </label>

              <RichTextEditor name="body" />
            </div>

            {/* Attachment File Upload */}
            <div className="space-y-2">
              <label htmlFor="attachment" className="block text-sm font-semibold text-slate-700">
                Attachment File <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="file"
                name="attachment"
                id="attachment"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                className="w-full text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-l-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition-colors"
              />
              <p className="text-xs text-slate-500">Supported formats: PDF, Word, JPG, PNG.</p>
            </div>

            {/* Categories (Checkboxes) */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Target Channels (Select all that apply)</label>
              <div className="grid grid-cols-2 gap-3">
                {categories?.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-slate-300">
                    <input type="checkbox" name="categories" value={cat.id} className="w-4 h-4 text-blue-600 rounded border-slate-300" />
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <TargetAudienceSelector programmes={programmes ?? []} />

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
                  Fill in these details if the announcement includes a
                  scheduled event. Students will be able to add it to
                  their calendars.
                </p>
              </div>

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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

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
                  placeholder="E.g., Main Lecture Hall"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <p className="text-xs text-slate-500">
                All event times are in Malaysia Time (MYT, UTC+8).
                Leave both dates empty for a general announcement.
              </p>
            </div>


            {/* Submit Button */}
            <div className="flex gap-3">
            <button
              type="submit"
              name="intent"
              value="draft"
              className="rounded-lg bg-slate-200 px-5 py-2 text-slate-700"
            >
              Save as Draft
            </button>

            <button
              type="submit"
              name="intent"
              value="published"
              className="rounded-lg bg-blue-600 px-5 py-2 text-white"
            >
              Publish Announcement
            </button>
            </div>
          </AnnouncementForm>
        </div>
      </div>
    </div>
  );
}