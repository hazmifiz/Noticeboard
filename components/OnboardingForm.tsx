'use client';

import { useActionState } from 'react';
import { completeOnboarding } from '@/app/onboarding/actions';
import {
  initialActionState,
} from '@/lib/action-state';
import FormFeedback from '@/components/FormFeedback';

type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function OnboardingForm({
  children,
  className,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    completeOnboarding,
    initialActionState
  );

  return (
    <form action={formAction} className={className}>
      {children}

      <FormFeedback
        type="error"
        message={state.error}
      />

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Saving profile...' : 'Complete Onboarding'}
      </button>
    </form>
  );
}