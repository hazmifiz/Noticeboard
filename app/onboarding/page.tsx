import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { completeOnboarding } from './actions';
import OnboardingForm from '@/components/OnboardingForm';


export default async function OnboardingPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  // Ensure user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Prevent users who already have a profile from accessing this page
  const { data: existingProfile } = await supabase
    .from('student_profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingProfile) redirect('/feed');

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="mb-6 text-center">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-xl mx-auto mb-4 shadow-md shadow-blue-500/20">
            CANS
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome to Campus Noticeboard</h1>
          <p className="text-sm text-slate-500 mt-2">Let's tailor your announcement feed to your exact academic needs.</p>
        </div>

        <OnboardingForm className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="full_name" className="block text-sm font-semibold text-slate-700">Full Name</label>
            <input 
              type="text" 
              name="full_name" 
              id="full_name" 
              placeholder="Full Name" 
              required 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="course_name" className="block text-sm font-semibold text-slate-700">Course</label>
            <div className="space-y-2">
              <label
                htmlFor="programme_id"
                className="block text-sm font-semibold text-slate-700"
              >
                Programme
              </label>

              <select
                name="programme_id"
                id="programme_id"
                required
                defaultValue=""
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>
                  Select your programme
                </option>

                {programmes?.map((programme) => (
                  <option key={programme.id} value={programme.id}>
                    {programme.code} - {programme.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="semester" className="block text-sm font-semibold text-slate-700">Current Semester</label>
            <input type="number" name="semester" id="semester" min="1" max="9" placeholder="1" required className="text-slate-500 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </OnboardingForm>
      </div>
    </div>
  );
}