'use client';

import { hasPermission, primaryRole, type Permission } from '@medetherial/shared';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useApiQuery } from './api';
import type { Me } from './types';

export function useRoles() {
  const { data } = useSession();
  const roles = data?.roles ?? [];
  return {
    roles,
    primary: primaryRole(roles),
    can: (p: Permission) => hasPermission(roles, p),
    is: (r: string) => roles.includes(r as never),
  };
}

export function useMe() {
  return useApiQuery<Me>(['me'], '/me', { staleTime: 60_000 });
}

/** Re-renders every `ms` — used for live countdowns and "x minutes ago" labels. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
