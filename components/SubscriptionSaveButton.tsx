'use client';

import { useFormStatus } from 'react-dom';

export default function SubscriptionSaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Saving preferences...' : 'Save Preferences'}
    </button>
  );
}