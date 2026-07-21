// Shared form field: visible label, error tied by aria-describedby, required
// marked in text — never colour or an asterisk alone (DESIGN §9). Used by the
// create and edit forms so the two stay identical.

export const inputClass =
  "w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-base text-text " +
  "focus-visible:border-focus";

export function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-text-body">
        {label}
        {required && (
          <span className="font-normal text-text-muted"> (required)</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1 text-sm text-danger"
        >
          <span aria-hidden>⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}
