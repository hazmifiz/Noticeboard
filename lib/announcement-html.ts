import DOMPurify from 'isomorphic-dompurify';

export function sanitizeAnnouncementHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 's',
      'h2', 'h3', 'ul', 'ol', 'li',
      'blockquote', 'a', 'code', 'pre',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

export function hasAnnouncementText(html: string): boolean {
  const text = html
    // Remove non-visible content.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML tags.
    .replace(/<[^>]*>/g, '')
    // Remove common HTML whitespace entities.
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    // Remove zero-width and non-breaking spaces.
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim();

  return text.length > 0;
}