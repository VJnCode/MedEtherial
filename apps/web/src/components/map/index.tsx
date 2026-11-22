'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/primitives';

export type { LiveMapProps, MapMarker, MapRoute } from './live-map';

/** Leaflet touches `window`, so the map is client-only. */
export const LiveMap = dynamic(() => import('./live-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});
