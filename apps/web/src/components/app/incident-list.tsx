'use client';

import { formatDistanceToNow } from 'date-fns';
import { Ambulance, ChevronRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, IncidentStatusBadge, ListSkeleton, SeverityBadge } from '@/components/common';
import type { Incident } from '@/lib/types';
import { cn, formatEta } from '@/lib/utils';

export function IncidentList({
  items,
  loading,
  selectedId,
  onSelect,
  emptyText = 'No active incidents.',
}: {
  items?: Incident[];
  loading?: boolean;
  selectedId?: string;
  onSelect?: (i: Incident) => void;
  emptyText?: string;
}) {
  if (loading) return <ListSkeleton rows={3} />;
  if (!items?.length) return <EmptyState icon={ShieldCheck} title="All clear" description={emptyText} />;
  return (
    <ul className="space-y-2">
      {items.map((i) => {
        const body = (
          <div
            className={cn(
              'hover:bg-muted/50 flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
              selectedId === i.id && 'border-primary bg-primary/5',
              i.severity === 'critical' && 'border-l-destructive border-l-4',
            )}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold">{i.reference}</span>
                <SeverityBadge severity={i.severity} />
                <IncidentStatusBadge status={i.status} />
              </div>
              <p className="truncate text-sm">{i.symptoms.join(', ')}</p>
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
                <span>{formatDistanceToNow(new Date(i.createdAt), { addSuffix: true })}</span>
                {i.ambulance && (
                  <span className="flex items-center gap-1">
                    <Ambulance className="size-3" /> {i.ambulance.callsign}
                  </span>
                )}
                {i.etaSeconds !== undefined && i.etaSeconds !== null && ['assigned', 'en_route', 'transporting'].includes(i.status) && (
                  <span>ETA {formatEta(i.etaSeconds)}</span>
                )}
              </p>
            </div>
            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          </div>
        );
        return (
          <li key={i.id}>
            {onSelect ? (
              <button type="button" className="w-full cursor-pointer" onClick={() => onSelect(i)}>
                {body}
              </button>
            ) : (
              <Link href={`/app/incidents/${i.id}`}>{body}</Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
