export function getFriendlyActionError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : '';

  const rules: Array<[RegExp, string]> = [
    [
      /title and.*body|required.*title|invalid announcement data/i,
      'Please provide an announcement title and body.',
    ],
    [
      /body cannot be empty|announcement body is required/i,
      'Please enter an announcement body.',
    ],
    [
      /select at least one programme|select programmes and semesters/i,
      'Please select at least one programme and one semester.',
    ],
    [
      /invalid programme selection|inactive programme/i,
      'One of your selected programmes is unavailable. Please select an active programme.',
    ],
    [
      /invalid semester/i,
      'Please select a valid semester.',
    ],
    [
      /both event start and end|provide both event start/i,
      'Please enter both the event start and end times.',
    ],
    [
      /event end.*later|event end.*after event start/i,
      'Event end time must be later than event start time.',
    ],
    [
      /invalid event date|invalid event information/i,
      'Please check the event dates and try again.',
    ],
    [
      /event location.*200|event location is too long/i,
      'Event location must be 200 characters or fewer.',
    ],
    [
      /event location requires|event dates when specifying/i,
      'Please enter event dates or clear the event location.',
    ],
    [
      /unsupported attachment type/i,
      'This file type is not supported. Please upload a PDF, Word document, or supported image.',
    ],
    [
      /attachment.*10 MB/i,
      'The attachment must be smaller than 10 MB.',
    ],
    [
      /announcement not found or access denied/i,
      'This announcement is unavailable or you do not have permission to edit it.',
    ],
  ];

  for (const [pattern, friendlyMessage] of rules) {
    if (pattern.test(message)) {
      return friendlyMessage;
    }
  }

  // Do not expose database internals or technical stack traces.
  return 'Something went wrong while saving. Please try again.';
}