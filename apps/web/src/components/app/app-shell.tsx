'use client';

import { ROLE_LABELS, primaryRole } from '@medetherial/shared';
import { LogOut, Menu, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { Logo, ThemeToggle } from '@/components/brand';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/overlay';
import { Avatar, AvatarFallback, Badge, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/primitives';
import { useMe } from '@/lib/hooks';
import { navFor, type NavItem } from '@/lib/nav';
import { SocketProvider, useSocket } from '@/lib/socket';
import { cn, initials } from '@/lib/utils';

export async function federatedSignOut() {
  try {
    const res = await fetch('/api/auth/federated-logout');
    const { url } = (await res.json()) as { url: string };
    await signOut({ redirect: false });
    window.location.href = url;
  } catch {
    await signOut({ redirectTo: '/' });
  }
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <nav className="space-y-6" aria-label="App">
      {groups.map((g) => (
        <div key={g} className="space-y-1">
          <p className="text-muted-foreground px-3 text-[11px] font-semibold tracking-wider uppercase">{g}</p>
          {items
            .filter((i) => i.group === g)
            .map((item) => {
              const active = item.href === '/app' ? pathname === '/app' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                    item.href === '/app/emergency' && !active && 'text-destructive hover:text-destructive',
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}

function ConnectionDot() {
  const { connected } = useSocket();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-muted-foreground hidden items-center gap-2 rounded-full border px-2.5 py-1 text-xs sm:flex" data-testid="live-indicator">
          <span className={cn('size-2 rounded-full', connected ? 'bg-success animate-pulse' : 'bg-muted-foreground/40')} />
          {connected ? 'Live' : 'Offline'}
        </span>
      </TooltipTrigger>
      <TooltipContent>{connected ? 'Receiving real-time updates' : 'Reconnecting to real-time updates…'}</TooltipContent>
    </Tooltip>
  );
}

/**
 * When an administrator approves (or removes) a role, the API flags the current token as stale.
 * Fetch a fresh token once so the menus and route guards pick up the new roles.
 */
function RoleSync() {
  const { update } = useSession();
  const me = useMe();
  const qc = useQueryClient();
  const syncing = useRef(false);
  const stale = me.data?.rolesStale === true;
  useEffect(() => {
    if (!stale || syncing.current) return;
    syncing.current = true;
    void update()
      .then(() => qc.invalidateQueries())
      .finally(() => {
        // Allow another attempt later (e.g. after the next approval), but not in a tight loop.
        setTimeout(() => (syncing.current = false), 30_000);
      });
  }, [stale, update, qc]);
  return null;
}

function UserMenu() {
  const { data } = useSession();
  const roles = data?.roles ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback>{initials(data?.user?.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm md:inline">{data?.user?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate">{data?.user?.name}</p>
          <p className="text-muted-foreground truncate text-xs font-normal">{data?.user?.email}</p>
          <div className="flex flex-wrap gap-1 pt-1">
            {roles.map((r) => (
              <Badge key={r} variant="secondary">
                {ROLE_LABELS[r]}
              </Badge>
            ))}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/profile">
            <UserRound /> Profile & settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void federatedSignOut()} data-testid="sign-out">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data, status } = useSession();
  const roles = data?.roles ?? [];
  const items = navFor(roles);

  // Expired refresh token → back through the login flow.
  useEffect(() => {
    if (data?.error === 'RefreshTokenError') window.location.href = '/login?callbackUrl=' + encodeURIComponent(window.location.pathname);
  }, [data?.error]);

  return (
    <SocketProvider>
      <RoleSync />
      <div className="flex min-h-dvh">
        <aside className="bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
          <div className="flex h-16 items-center px-5">
            <Logo href="/app" />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">{status !== 'loading' && <NavLinks items={items} />}</div>
          <div className="text-muted-foreground border-sidebar-border border-t px-5 py-4 text-xs">
            Signed in as <span className="text-foreground font-medium">{ROLE_LABELS[primaryRole(roles)]}</span>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="bg-background/80 sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-xl sm:px-6">
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="bg-sidebar p-0">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="flex h-16 items-center px-5">
                    <Logo href="/app" />
                  </div>
                  <div className="overflow-y-auto px-3 py-4">
                    <NavLinks items={items} />
                  </div>
                </SheetContent>
              </Sheet>
              <span className="lg:hidden">
                <Logo href="/app" className="[&>span]:hidden sm:[&>span]:inline" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionDot />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
        </div>
      </div>
    </SocketProvider>
  );
}
