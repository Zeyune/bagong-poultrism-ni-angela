import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  // DESIGN §2 tokens. Hover shifts one step (§7); focus is handled globally.
  primary:
    "bg-primary text-white hover:bg-primary-hover disabled:opacity-40",
  secondary:
    "border border-border-strong text-text hover:bg-surface disabled:opacity-40",
  danger:
    "bg-danger text-white hover:brightness-95 disabled:opacity-40",
  ghost: "text-secondary hover:bg-secondary-weak disabled:opacity-40",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

// A plain, accessible button. 44px min height for the gloved one-handed context
// (§9), text-base so touch targets and type meet the floor.
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
