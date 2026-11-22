'use client';

import {
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_RANK,
  SELF_SERVICE_ROLES,
  canGrantRole,
  type Role,
  type RoleRequestStatus,
} from '@medetherial/shared';
import { formatDistanceToNow } from 'date-fns';
import { Check, Clock, KeyRound, Send, ShieldCheck, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorNote, ListSkeleton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlay';
import { Badge, Label, Textarea } from '@/components/ui/primitives';
import { useApiMutation, useApiQuery, type Page } from '@/lib/api';
import type { RoleRequest } from '@/lib/types';

/** Roles ordered from most to least authority. */
export const ROLES_BY_RANK = [...ROLES].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);

const STATUS_BADGE: Record<RoleRequestStatus, { label: string; variant: 'warning' | 'success' | 'destructive' | 'muted' }> = {
  pending: { label: 'Awaiting approval', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Declined', variant: 'destructive' },
  cancelled: { label: 'Withdrawn', variant: 'muted' },
};

export function RoleRequestStatusBadge({ status }: { status: RoleRequestStatus }) {
  const s = STATUS_BADGE[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const ROLE_KEYS = [['me'], ['my-role-requests'], ['admin-role-requests'], ['admin-users']];

// ------------------------------------------------------------------ profile

/** Profile card: see your roles, give one up, or ask for another. */
export function MyRolesCard({ roles }: { roles: Role[] }) {
  const requests = useApiQuery<RoleRequest[]>(['my-role-requests'], '/me/role-requests');
  const pending = new Set((requests.data ?? []).filter((r) => r.status === 'pending').map((r) => r.role));
  const available = ROLES_BY_RANK.filter((r) => !roles.includes(r) && !pending.has(r)).reverse();
  const [role, setRole] = useState<Role | ''>('');
  const [reason, setReason] = useState('');
  const [removing, setRemoving] = useState<Role | null>(null);

  const instant = role !== '' && (SELF_SERVICE_ROLES.includes(role) || canGrantRole(roles, role));
  const ask = useApiMutation<void, { granted: boolean }>(
    () => ({ path: '/me/role-requests', body: { role, reason: reason || undefined } }),
    {
      invalidate: ROLE_KEYS,
      success: (r) => (r.granted ? `${ROLE_LABELS[role as Role]} role added` : 'Request sent. An administrator will review it.'),
      onSuccess: () => {
        setRole('');
        setReason('');
      },
    },
  );
  const withdraw = useApiMutation<string>((id) => ({ path: `/me/role-requests/${id}`, method: 'DELETE' }), {
    invalidate: ROLE_KEYS,
    success: 'Request withdrawn',
  });
  const remove = useApiMutation<Role>((r) => ({ path: `/me/roles/${r}`, method: 'DELETE' }), {
    invalidate: ROLE_KEYS,
    success: 'Role removed',
    onSuccess: () => setRemoving(null),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles & access</CardTitle>
        <CardDescription>
          Everyone can be a patient. Clinical, crew and staff roles need an administrator’s approval. Roles rank from Administrator down to Patient.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="divide-y rounded-lg border">
          {ROLES_BY_RANK.filter((r) => roles.includes(r)).map((r) => (
            <li key={r} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="text-success size-4" /> {ROLE_LABELS[r]}
                </p>
                <p className="text-muted-foreground text-sm">{ROLE_DESCRIPTIONS[r]}</p>
              </div>
              <Button variant="ghost" size="sm" disabled={roles.length <= 1} onClick={() => setRemoving(r)} aria-label={`Remove ${ROLE_LABELS[r]} role`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>

        {available.length > 0 && (
          <form
            className="space-y-3 rounded-lg border border-dashed p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (role) ask.mutate();
            }}
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4" /> Add a role
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="role-request">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="role-request" className="sm:w-72">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {role && <p className="text-muted-foreground text-xs">{ROLE_DESCRIPTIONS[role]}</p>}
            </div>
            {role && !instant && (
              <div className="space-y-1.5">
                <Label htmlFor="role-reason">Why do you need it? (optional)</Label>
                <Textarea
                  id="role-reason"
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="E.g. registration number, hospital, team"
                />
              </div>
            )}
            <Button type="submit" disabled={!role || ask.isPending}>
              <Send /> {instant ? 'Add role' : 'Request approval'}
            </Button>
          </form>
        )}

        {Boolean(requests.data?.length) && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Your requests</p>
            <ul className="divide-y rounded-lg border">
              {requests.data!.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{ROLE_LABELS[r.role]}</span>
                      <RoleRequestStatusBadge status={r.status} />
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Requested {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      {r.decidedBy && ` · ${r.status === 'approved' ? 'approved' : 'reviewed'} by ${r.decidedBy.name}`}
                      {r.note && ` · “${r.note}”`}
                    </p>
                  </div>
                  {r.status === 'pending' && (
                    <Button variant="ghost" size="sm" disabled={withdraw.isPending} onClick={() => withdraw.mutate(r.id)}>
                      <Undo2 /> Withdraw
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <Dialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        {removing && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove the {ROLE_LABELS[removing]} role?</DialogTitle>
              <DialogDescription>
                {SELF_SERVICE_ROLES.includes(removing)
                  ? 'You can add it back at any time.'
                  : 'You will lose this access straight away. Getting it back needs an administrator’s approval.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoving(null)}>
                Keep role
              </Button>
              <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(removing)}>
                Remove role
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}

// ------------------------------------------------------------------ admin

/** Approval queue for administrators. */
export function RoleRequestsPanel() {
  const res = useApiQuery<Page<RoleRequest>>(['admin-role-requests'], '/admin/role-requests?status=pending&limit=50');
  const decide = useApiMutation<{ id: string; approve: boolean }, { request: RoleRequest }>(
    ({ id, approve }) => ({ path: `/admin/role-requests/${id}/${approve ? 'approve' : 'reject'}`, body: {} }),
    {
      invalidate: ROLE_KEYS,
      success: (r) => (r.request.status === 'approved' ? 'Approved. The role is active on the user’s next request.' : 'Request declined'),
    },
  );
  const items = res.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4" /> Role requests
          {items.length > 0 && <Badge variant="warning">{items.length}</Badge>}
        </CardTitle>
        <CardDescription>People who signed up as patients and asked for a clinical, crew or staff role.</CardDescription>
      </CardHeader>
      <CardContent>
        <ErrorNote error={res.error} />
        {res.isLoading ? (
          <ListSkeleton rows={2} />
        ) : !items.length ? (
          <EmptyState icon={ShieldCheck} title="No pending requests" description="New requests from the profile page show up here." />
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((r) => {
              const user = typeof r.user === 'string' ? null : r.user;
              return (
                <li key={r.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {user?.name ?? 'Unknown user'} <span className="text-muted-foreground font-normal">wants</span> {ROLE_LABELS[r.role]}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {user?.email} · now {user?.roles.map((x) => ROLE_LABELS[x]).join(', ') || 'no roles'} · {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                    </p>
                    {r.reason && <p className="bg-muted/50 rounded-md px-3 py-2 text-sm">{r.reason}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: false })}>
                      <X /> Decline
                    </Button>
                    <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true })}>
                      <Check /> Approve
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
