'use client';

import React, { useState, useTransition } from 'react';
import { createAnnouncement } from './actions';
import { Category } from './page';

interface Props {
  categories: Category[];
}

export default function CreateAnnouncementForm({ categories }: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createAnnouncement(formData);
      } catch (err: any) {
        setErrorMsg(err.message || 'An unexpected error occurred.');
      }
    });
  };

  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Create New Announcement</h1>
        <p className="text-xs text-slate-500 mt-1">Publish news or updates directly to subscribed student feeds.</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Announcement Title
          </label>
          <input
            type="text"
            name="title"
            required
            placeholder="e.g., Spring Midterm Examination Schedule"
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Category Dropdown */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Category / Tag
          </label>
          <select
            name="categoryId"
            required
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Body Content Textarea */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Body Content
          </label>
          <textarea
            name="body"
            rows={6}
            required
            placeholder="Write your announcement details here..."
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Urgent Tier 1 Checkbox */}
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-3">
          <input
            type="checkbox"
            id="isUrgent"
            name="isUrgent"
            className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 h-4 w-4"
          />
          <label htmlFor="isUrgent" className="text-xs font-medium text-amber-900 cursor-pointer">
            Mark as Urgent (Tier 1 Alert). Pins to the top of all student feeds.
          </label>
        </div>

        {/* Attachment Upload */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Attachment (Optional)
          </label>
          <input
            type="file"
            name="attachment"
            accept=".pdf,.png,.jpg,.jpeg"
            className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <a
            href="/feed"
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            {isPending ? 'Publishing...' : 'Publish Announcement'}
          </button>
        </div>
      </form>
    </div>
  );
}