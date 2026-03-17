'use client';

export function LearningToast({
  onDismiss,
  ...rest
}: {
  facts: Array<{ text: string; type: string }>;
  propertyId: string;
  reservationId: string;
  onDismiss: () => void;
  onSaved: () => void;
}) {
  // Placeholder — full implementation in Task 10
  void rest;
  return (
    <div className="px-4 py-2 text-xs" style={{ color: '#60a5fa' }}>
      <button onClick={onDismiss}>✕ Dismiss learning</button>
    </div>
  );
}
