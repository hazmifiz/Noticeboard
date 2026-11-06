type CalendarEvent = {
  title: string;
  description?: string | null;
  start: string;
  end: string;
  location?: string | null;
};

function formatGoogleDate(value: string): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function getGoogleCalendarUrl(
  event: CalendarEvent
): string {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    throw new Error('Invalid calendar event dates');
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates:
      `${formatGoogleDate(event.start)}/` +
      formatGoogleDate(event.end),
    details: event.description ?? '',
    location: event.location ?? '',
    ctz: 'Asia/Kuala_Lumpur',
  });

  return (
    'https://calendar.google.com/calendar/render?' +
    params.toString()
  );
}