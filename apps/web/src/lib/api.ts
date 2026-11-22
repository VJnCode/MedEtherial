'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';
import { toast } from 'sonner';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export interface Problem {
  title: string;
  status: number;
  detail: string;
  errors?: { path: string; message: string }[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: Problem,
  ) {
    super(problem.detail || problem.title);
  }
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export async function apiFetch<T>(
  path: string,
  opts: { token?: string; method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const p = data as Partial<Problem>;
    throw new ApiError(res.status, {
      title: p.title ?? res.statusText,
      status: res.status,
      detail: p.detail ?? 'Request failed',
      errors: p.errors,
    });
  }
  return data as T;
}

export function useAccessToken() {
  const { data, status } = useSession();
  return { token: data?.accessToken, ready: status !== 'loading' && Boolean(data?.accessToken) };
}

/** Authenticated query bound to the current OIDC access token. */
export function useApiQuery<T>(
  key: readonly unknown[],
  path: string | null,
  options: Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'> = {},
) {
  const { token, ready } = useAccessToken();
  return useQuery<T, ApiError>({
    queryKey: key,
    queryFn: ({ signal }) => apiFetch<T>(path!, { token, signal }),
    enabled: ready && path !== null && (options.enabled ?? true),
    ...options,
  });
}

export function useApiMutation<TBody, TResult = unknown>(
  build: (body: TBody) => { path: string; method?: string; body?: unknown },
  opts: { invalidate?: readonly unknown[][]; success?: string | ((r: TResult) => string); onSuccess?: (r: TResult) => void } = {},
) {
  const { token } = useAccessToken();
  const qc = useQueryClient();
  return useMutation<TResult, ApiError, TBody>({
    mutationFn: (body) => {
      const req = build(body);
      return apiFetch<TResult>(req.path, { token, method: req.method ?? 'POST', body: req.body });
    },
    onSuccess: (r) => {
      for (const k of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: k });
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.onSuccess?.(r);
    },
    onError: (err) => {
      toast.error(err.problem?.title ?? 'Something went wrong', { description: err.message });
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return useCallback((...keys: unknown[][]) => keys.forEach((k) => void qc.invalidateQueries({ queryKey: k })), [qc]);
}
