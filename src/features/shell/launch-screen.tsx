import { LogoMark } from '@/components/brand/logo';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';

/** What people see for the split second while the session is restored. */
export function LaunchScreen({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center">
      <SpaceBackdrop />
      <div className="motion-ok:animate-[twinkle_2.4s_var(--ease-in-out)_infinite]">
        <LogoMark size={88} />
      </div>
    </div>
  );
}
