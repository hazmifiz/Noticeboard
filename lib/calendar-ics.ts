type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  start: string;
  end: string;
  location?: string | null;
};

function formatICalDate(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

// Escape special characters required by iCalendar.
function escapeICalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

// iCalendar content lines must be folded at 75 octets.
// Use a TextEncoder so multibyte characters are counted correctly.
function foldICalLine(line: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = '';

  for (const char of line) {
    const candidate = current + char;

    if (encoder.encode(candidate).length > 75) {
      lines.push(current);
      current = ' ' + char;
    } else {
      current = candidate;
    }
  }

  lines.push(current);
  return lines.join('\r\n');
}

export function generateICS(event: CalendarEvent): string {
  const start = new Date(event.start);
  const end = new Date(event.end);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    throw new Error('Invalid calendar event dates');
  }

  const uid = `${event.id}@campus-noticeboard.local`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Campus Noticeboard//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    `DTSTART:${formatICalDate(start)}`,
    `DTEND:${formatICalDate(end)}`,
    `SUMMARY:${escapeICalText(event.title)}`,
    `DESCRIPTION:${escapeICalText(event.description ?? '')}`,
    `LOCATION:${escapeICalText(event.location ?? '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldICalLine).join('\r\n') + '\r\n';
}