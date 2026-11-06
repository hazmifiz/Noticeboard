'use client';

import { generateICS } from '@/lib/calendar-ics';

type Props = {
  id: string;
  title: string;
  description?: string | null;
  start: string;
  end: string;
  location?: string | null;
};

export default function DownloadCalendarButton({
  id,
  title,
  description,
  start,
  end,
  location,
}: Props) {
  function handleDownload(
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    // Prevent clicking the button from collapsing the card.
    event.stopPropagation();

    try {
      const icsContent = generateICS({
        id,
        title,
        description,
        start,
        end,
        location,
      });

      const blob = new Blob([icsContent], {
        type: 'text/calendar;charset=utf-8',
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `campus-event-${id}.ics`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Calendar download failed:', error);
      alert('Unable to download calendar event.');
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
    >
      <span aria-hidden="true">📥</span>
      Download Calendar (.ics)
    </button>
  );
}