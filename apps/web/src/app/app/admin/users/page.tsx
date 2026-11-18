'use client';

import { ROLES, ROLE_LABELS, type Role } from '@medetherial/shared';
import { formatDistanceToNow } from 'date-fns';
import { Search, ShieldCheck, UserCog } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlay';
import { Avatar, AvatarFallback, Badge, Checkbox, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { useApiMutation, useApiQuery, type Page } from '@/lib/api';
import type { AdminUser } from '@/lib/types';
import { initials } from '@/lib/utils';

function RolesDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const save = useApiMutation<void>(() => ({ path: `/admin/users/${user.id}/roles`, method: 'PUT', body: { roles } }), {
    invalidate: [['admin-users']],
    success: 'Roles updated in Keycloak. They take effect on the user’s next token refresh.',
    onSuccess: onClose,
  });
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Roles for {user.name}</DialogTitle>
        <DialogDescription>Changes are written to the identity provider (Keycloak) and audit-logged.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {ROLES.map((r) => (
          <Label key={r} className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal">
            <Checkbox checked={roles.includes(r)} onCheckedChange={(c) => setRoles(c ? [...roles, r] : roles.filter((x) => x !== r))} />
            <span className="font-medium">{ROLE_LABELS[r]}</span>
          </Label>
        ))}
      </div>
      <DialogFooter>
        <Button disabled={!roles.length || save.isPending} onClick={() => save.mutate()}>
          <ShieldCheck /> Save roles
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const dq = useDeferredValue(q);
  const params = new URLSearchParams({ page: String(page), limit: '25' });
  if (dq) params.set('q', dq);
  if (role !== 'all') params.set('role', role);
  const res = useApiQuery<Page<AdminUser>>(['admin-users', dq, role, page], `/admin/users?${params}`);

  return (
    <div className="space-y-6">
      <PageHeader title="Users & roles" description="Users are provisioned automatically on first sign-in. Manage their access here." />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by name or e-mail" className="pl-9" aria-label="Search users" />
        </div>
        <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <ErrorNote error={res.error} />
      <Card className="py-0">
        <CardContent className="px-0">
          {res.isLoading ? (
            <div className="p-4"><ListSkeleton /></div>
          ) : !res.data?.items.length ? (
            <div className="p-4"><EmptyState icon={UserCog} title="No users found" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Affiliation</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {res.data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar><AvatarFallback>{initials(u.name)}</AvatarFallback></Avatar>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-muted-foreground text-xs">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} variant={r === 'admin' ? 'default' : 'secondary'}>{ROLE_LABELS[r]}</Badge>)}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.hospital?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{u.lastSeenAt ? formatDistanceToNow(new Date(u.lastSeenAt), { addSuffix: true }) : 'Never'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setEditing(u)}>Edit roles</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {res.data && res.data.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Page {res.data.page} of {res.data.pages}</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= res.data.pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <RolesDialog user={editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}
