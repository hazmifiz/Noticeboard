import { getGoogleCalendarUrl } from '@/lib/calendar';

type Props = {
  title: string;
  description?: string | null;
  start: string;
  end: string;
  location?: string | null;
};

export default function GoogleCalendarButton({
  title,
  description,
  start,
  end,
  location,
}: Props) {
  const calendarUrl = getGoogleCalendarUrl({
    title,
    description,
    start,
    end,
    location,
  });

  return (
    <a
      href={calendarUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
      aria-label={`Add ${title} to Google Calendar`}
    >
      <span aria-hidden="true">📅</span>
      Add to Google Calendar
    </a>
  );
}