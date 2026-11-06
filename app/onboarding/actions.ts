'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { validateOnboarding } from '@/lib/onboarding-validation';
import {
  actionError,
  type ActionState,
} from '@/lib/action-state';

export async function completeOnboarding(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
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

  try {
    // 1. Validate all required onboarding fields.
    const { fullName, programmeId, semester } =
      validateOnboarding(formData);

    // 2. Verify that the programme exists and is active.
    const {
      data: selectedProgramme,
      error: programmeError,
    } = await supabase
      .from('programmes')
      .select('id, name')
      .eq('id', programmeId)
      .eq('is_active', true)
      .maybeSingle();

    if (programmeError) {
      console.error(
        'ONBOARDING PROGRAMME ERROR:',
        programmeError
      );

      return actionError(
        'Unable to verify your programme. Please try again.'
      );
    }

    if (!selectedProgramme) {
      return actionError(
        'The selected programme is unavailable. Please choose another.'
      );
    }

    // 3. Set enrollment year.
    const enrollmentYear = new Date().getFullYear();

    // 4. Update the user's name.
    const { error: userError } = await supabase
      .from('users')
      .update({
        full_name: fullName,
      })
      .eq('id', user.id);

    if (userError) {
      console.error('ONBOARDING NAME ERROR:', userError);

      return actionError(
        'Unable to save your name. Please try again.'
      );
    }

    // 5. Create the student profile.
    const { error: profileError } = await supabase
      .from('student_profiles')
      .insert({
        user_id: user.id,
        programme_id: selectedProgramme.id,
        course_name: selectedProgramme.name,
        semester,
        enrollment_year: enrollmentYear,
      });

    if (profileError) {
      console.error(
        'ONBOARDING PROFILE ERROR:',
        profileError
      );

      return actionError(
        'Unable to save your student profile. Please try again.'
      );
    }
  } catch (error) {
    console.error('COMPLETE ONBOARDING ERROR:', error);

    return actionError(
      error instanceof Error
        ? error.message
        : 'Unable to complete onboarding. Please try again.'
    );
  }

  // Redirect only after successful completion.
  redirect('/feed');
}