'use client';
import { BadgeCheck, Coins, Flag, Image as ImageIcon, LayoutDashboard, LogOut, Map, Megaphone, Settings, ShieldCheck, ShoppingBag, Truck, Users, Wallet, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { accessFor, useSession } from '@/lib/session';
import { cn } from '@/lib/cn';

interface Item { href: string; label: string; icon: LucideIcon; area: string; badge?: string; group?: string }
export const NAV: Item[] = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard, area: 'any' },
  { group: 'MODERATION', href: '/advice', label: 'Advice review', icon: BadgeCheck, area: 'moderation', badge: '42' },
  { href: '/reports', label: 'Reports', icon: Flag, area: 'moderation', badge: '17' },
  { href: '/content', label: 'Places & content', icon: ImageIcon, area: 'moderation' },
  { group: 'PEOPLE', href: '/users', label: 'Users & KYC', icon: Users, area: 'users' },
  { group: 'MONEY', href: '/transactions', label: 'Wallet & withdrawals', icon: Wallet, area: 'wallet', badge: '8' },
  { href: '/payouts', label: 'Creator payouts', icon: Coins, area: 'payouts' },
  { group: 'MARKETPLACE', href: '/plans', label: 'Trip plans', icon: Map, area: 'plans' },
  { href: '/products', label: 'Shop products', icon: ShoppingBag, area: 'shop' },
  { href: '/orders', label: 'Shop orders', icon: Truck, area: 'shop', badge: '23' },
  { group: 'ENGAGE', href: '/broadcasts', label: 'Notifications', icon: Megaphone, area: 'broadcasts' },
  { group: 'SYSTEM', href: '/admins', label: 'Admins & audit log', icon: ShieldCheck, area: 'settings' },
  { href: '/settings', label: 'Settings', icon: Settings, area: 'settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, signOut } = useSession();
  if (!admin) return null;
  const items = NAV.filter((i) => i.area === 'any' || accessFor(admin.role, i.area));
  return (
    <aside className="flex w-full flex-none flex-col bg-navy text-white lg:sticky lg:top-0 lg:h-screen lg:w-62">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-3">
        <Image src="/brand/everycation-logo-horizontal-white.svg" alt="EveryCation" width={150} height={34} priority />
        <span className="rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-ink">ADMIN</span>
      </div>
      <nav aria-label="Console" className="flex flex-1 gap-0.5 overflow-auto px-3 pb-3 max-lg:flex-row lg:flex-col">
        {items.map((i) => {
          const on = pathname.startsWith(i.href);
          return (
            <div key={i.href} className="contents">
              {i.group && <span className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-[0.08em] text-navy-soft max-lg:hidden">{i.group}</span>}
              <Link href={i.href} aria-current={on ? 'page' : undefined}
                className={cn('flex h-10 flex-none items-center gap-3 rounded-xl px-3 text-sm no-underline', on ? 'bg-white font-semibold text-navy hover:text-navy' : 'font-medium text-white hover:bg-white/10 hover:text-white')}>
                <i.icon className="size-[18px] flex-none" strokeWidth={1.8} aria-hidden />
                <span className="flex-1 whitespace-nowrap">{i.label}</span>
                {i.badge && <span className="rounded-full bg-gold px-2 py-px text-[11px] font-bold text-ink">{i.badge}</span>}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="flex items-center gap-3 border-t border-white/15 px-5 py-4 max-lg:hidden">
        <span aria-hidden className="grid size-9 place-items-center rounded-full bg-gold text-[13px] font-bold text-ink">{admin.initials}</span>
        <span className="flex flex-1 flex-col leading-tight"><b className="text-sm font-semibold">{admin.name}</b><span className="text-xs text-navy-soft">{admin.role}</span></span>
        <button aria-label="Sign out" onClick={() => { signOut(); router.replace('/'); }} className="cursor-pointer rounded-lg p-2 hover:bg-white/10"><LogOut className="size-[18px]" /></button>
      </div>
    </aside>
  );
}
