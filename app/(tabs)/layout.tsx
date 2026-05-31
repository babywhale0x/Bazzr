'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Lock, PlusCircle, User } from 'lucide-react';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const tabs = [
  { name: 'Home',    href: '/home',    icon: Home },
  { name: 'Explore', href: '/explore', icon: Compass },
  { name: 'Vault',   href: '/vault',   icon: Lock },
  { name: 'Create',  href: '/create',  icon: PlusCircle },
  { name: 'Profile', href: '/profile', icon: User },
];

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-bg font-sans leading-[1.6] text-text-secondary">
      {/* ─── Top Navigation ─── */}
      <nav className="bg-surface border-b border-border sticky top-0 z-[100]">
        <div className="max-w-[1440px] mx-auto px-8 w-full h-[60px] flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-[17px] font-medium text-text-primary tracking-[-0.01em] shrink-0">
            Veri<span className="text-primary">xa</span>
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center gap-8 list-none">
            {tabs.map(tab => {
              const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <li key={tab.name}>
                  <Link
                    href={tab.href}
                    className={`text-[14px] transition-colors ${
                      isActive
                        ? 'font-medium text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tab.name}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right: Theme Toggle + Connect */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>{children}</main>

      {/* ─── Mobile Bottom Navigation ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border">
        <div className="flex items-center justify-around h-[56px]">
          {tabs.map(tab => {
            const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                  isActive ? 'text-primary' : 'text-text-muted'
                }`}
              >
                <tab.icon className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-[11px] font-medium">{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile spacer */}
      <div className="md:hidden h-14" />
    </div>
  );
}

