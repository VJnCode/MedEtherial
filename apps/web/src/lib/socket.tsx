'use client';

import type { ClientToServerEvents, ServerToClientEvents } from '@medetherial/shared';
import { useSession } from 'next-auth/react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SocketContext = createContext<{ socket: AppSocket | null; connected: boolean }>({ socket: null, connected: false });

/**
 * One authenticated Socket.IO connection per tab. The auth callback always reads the
 * freshest access token, so reconnects after token refresh keep working.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { data } = useSession();
  const tokenRef = useRef<string | undefined>(data?.accessToken);
  tokenRef.current = data?.accessToken;
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const hasToken = Boolean(data?.accessToken);

  useEffect(() => {
    if (!hasToken) return;
    const s: AppSocket = io(API_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: tokenRef.current }),
      reconnectionDelayMax: 10_000,
    });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));
    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
  }, [hasToken]);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

/** Subscribe to a server event for the component's lifetime. */
export function useSocketEvent<E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return;
    const fn = ((...args: Parameters<ServerToClientEvents[E]>) =>
      (ref.current as (...a: unknown[]) => void)(...args)) as unknown as ServerToClientEvents[E];
    socket.on(event, fn as never);
    return () => {
      socket.off(event, fn as never);
    };
  }, [socket, event]);
}

/** Joins an incident room (server authorises access) and re-joins after reconnects. */
export function useWatchIncident(incidentId?: string) {
  const { socket, connected } = useSocket();
  useEffect(() => {
    if (!socket || !connected || !incidentId) return;
    socket.emit('incident:watch', incidentId, () => undefined);
    return () => {
      socket.emit('incident:unwatch', incidentId);
    };
  }, [socket, connected, incidentId]);
}
