'use client';

import { useActionState, useState } from 'react';
import FormFeedback from '@/components/FormFeedback';
import {
  initialActionState,
  type ActionState,
} from '@/lib/action-state';

type Props = {
  children: React.ReactNode;
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  className?: string;
};

export default function AnnouncementForm({
  children,
  action,
  className,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialActionState
  );

  const [clientError, setClientError] = useState('');

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    const form = event.currentTarget;
    const formData = new FormData(form);

    setClientError('');

    if (isPending) {
      event.preventDefault();
      return;
    }

    const start = String(formData.get('event_start') ?? '');
    const end = String(formData.get('event_end') ?? '');

    if (Boolean(start) !== Boolean(end)) {
      event.preventDefault();
      setClientError(
        'Please provide both event start and end times.'
      );
      return;
    }

    if (start && end && end <= start) {
      event.preventDefault();
      setClientError(
        'Event end time must be later than event start time.'
      );
      return;
    }

    // Keep your other existing client-side validation here.
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className={className}
    >
      {children}

      <FormFeedback
        type="error"
        message={clientError || state.error}
      />

      {isPending && (
        <p className="text-sm text-blue-600">
          Saving, please wait...
        </p>
      )}
    </form>
  );
}