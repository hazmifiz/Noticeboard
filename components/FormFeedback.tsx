type Props = {
  message?: string | null;
  type?: 'error' | 'success' | 'info';
};

export default function FormFeedback({
  message,
  type = 'error',
}: Props) {
  if (!message) return null;

  const styles = {
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-green-200 bg-green-50 text-green-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  const icons = {
    error: '⚠️',
    success: '✓',
    info: 'ℹ️',
  };

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${styles[type]}`}
    >
      <span aria-hidden="true">{icons[type]}</span>
      <p className="font-medium">{message}</p>
    </div>
  );
}