export type FeedbackType = 'success' | 'error';

export function buildFeedbackUrl(
  pathname: string,
  type: FeedbackType,
  message: string,
  extraParams: Record<string, string> = {}
): string {
  const params = new URLSearchParams(extraParams);

  params.set(type, message);

  return `${pathname}?${params.toString()}`;
}