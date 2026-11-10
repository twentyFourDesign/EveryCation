'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { NAV, Sidebar } from '@/components/sidebar';
import { accessFor, useSession } from '@/lib/session';

const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const admin = useSession((s) => s.admin);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => { if (hydrated && !admin) router.replace('/'); }, [hydrated, admin, router]);
  if (!hydrated || !admin) return <div className="min-h-screen bg-surface-muted" />;

  const item = NAV.find((i) => pathname.startsWith(i.href));
  const allowed = !item || item.area === 'any' || accessFor(admin.role, item.area);
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-7 pb-12 sm:px-8 lg:px-10">
        {allowed ? children : <p role="alert" className="rounded-card bg-white p-6 text-sm">Your role ({admin.role}) does not have access to this page. Ask a Super admin if you need it.</p>}
      </main>
    </div>
  );
}
