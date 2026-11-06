'use client';

import { useActionState, useState } from 'react';
import { deleteAnnouncementWithFeedback } from '@/app/manage/actions';
import FormFeedback from '@/components/FormFeedback';

type Props = {
  announcementId: string;
  announcementTitle: string;
};

type DeleteState = {
  error: string | null;
};

const initialState: DeleteState = {
  error: null,
};

export default function DeleteAnnouncementButton({
  announcementId,
  announcementTitle,
}: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  const [state, formAction, isPending] = useActionState(
    deleteAnnouncementWithFeedback,
    initialState
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
      >
        Delete
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2
              id="delete-dialog-title"
              className="text-xl font-bold text-slate-900"
            >
              Delete Announcement?
            </h2>

            <p
              id="delete-dialog-description"
              className="mt-3 text-sm text-slate-600"
            >
              Are you sure you want to delete{' '}
              <strong>{announcementTitle}</strong>?
              This action cannot be undone.
            </p>

            <div className="mt-4">
              <FormFeedback
                type="error"
                message={state.error}
              />
            </div>

            <form action={formAction}>
              <input
                type="hidden"
                name="announcement_id"
                value={announcementId}
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setShowConfirm(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}