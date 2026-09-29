import { LogoMark } from '@/components/brand/logo';

/** What people see for the split second while the session is restored: the mark draws itself around the shadow. */
export function LaunchScreen({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-bg"
    >
      <LogoMark size={88} animated />
    </div>
  );
}
