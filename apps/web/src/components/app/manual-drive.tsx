'use client';

import type { LatLng } from '@medetherial/shared';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CarFront, Compass, LogOut, MousePointerClick } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { LiveMap } from '@/components/map';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlay';
import { Badge, Label } from '@/components/ui/primitives';
import { useSocket } from '@/lib/socket';
import type { Ambulance } from '@/lib/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------- physics (pure, unit-tested)

const M_PER_DEG_LAT = 111_320;

/** Moves `meters` (negative = backwards) along a compass heading (0 = north, 90 = east). */
export function offset(p: LatLng, headingDeg: number, meters: number): LatLng {
  const rad = (headingDeg * Math.PI) / 180;
  return {
    lat: p.lat + (meters * Math.cos(rad)) / M_PER_DEG_LAT,
    lng: p.lng + (meters * Math.sin(rad)) / (M_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180)),
  };
}

export interface CarState {
  pos: LatLng;
  /** Degrees, 0 = north. */
  heading: number;
  /** m/s; negative while reversing. */
  speed: number;
}

export interface CarInput {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  handbrake: boolean;
}

export const NO_INPUT: CarInput = { throttle: false, brake: false, left: false, right: false, boost: false, handbrake: false };

const ACCEL = 4; // m/s²
const BOOST_ACCEL = 7;
const BRAKE = 9;
const HANDBRAKE = 14;
const COAST = 1.5;
const REVERSE_MAX = 20 / 3.6;
const TURN_RATE = 75; // °/s at speed

/** Advances the car by `dt` seconds: arcade-style acceleration, braking into reverse and speed-dependent steering. */
export function stepCar(car: CarState, input: CarInput, dt: number, maxKmh: number): CarState {
  const maxFwd = (maxKmh / 3.6) * (input.boost ? 1.8 : 1);
  let v = car.speed;
  const towardsZero = (decel: number) => (v > 0 ? Math.max(0, v - decel * dt) : Math.min(0, v + decel * dt));

  if (input.handbrake) v = towardsZero(HANDBRAKE);
  else if (input.throttle && !input.brake) v = v < 0 ? towardsZero(BRAKE) : v + (input.boost ? BOOST_ACCEL : ACCEL) * dt;
  else if (input.brake && !input.throttle) v = v > 0 ? towardsZero(BRAKE) : v - ACCEL * 0.6 * dt;
  else v = towardsZero(COAST);
  v = Math.max(-REVERSE_MAX, Math.min(maxFwd, v));

  // You can't turn on the spot; steering builds up with speed and flips when reversing.
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const grip = Math.min(1, Math.abs(v) / 5);
  const heading = (((car.heading + steer * TURN_RATE * grip * dt * Math.sign(v)) % 360) + 360) % 360;

  return { pos: offset(car.pos, heading, v * dt), heading, speed: v };
}

export function compassPoint(heading: number) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(heading / 45) % 8]!;
}

// ---------------------------------------------------------------- component

const TICK_MS = 50;
/** The API accepts one ping per unit every 800 ms. */
const PUBLISH_MS = 1000;
const TOP_SPEEDS = [40, 60, 100, 160] as const;

const KEYS: Record<string, keyof CarInput> = {
  ArrowUp: 'throttle',
  w: 'throttle',
  ArrowDown: 'brake',
  s: 'brake',
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  ' ': 'handbrake',
};

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

function KeyCap({ on, children, wide }: { on: boolean; children: ReactNode; wide?: boolean }) {
  return (
    <span
      className={cn(
        'grid h-9 place-items-center rounded-md border-b-4 text-xs font-semibold transition-all',
        wide ? 'w-20' : 'w-9',
        on ? 'translate-y-0.5 border-sky-700 bg-sky-500 text-white' : 'border-black/40 bg-white/15 text-white/80',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Testing aid: drive an ambulance like a car with the keyboard. Positions are published exactly
 * like a crew phone's GPS, so the simulator steps aside (until 60 s after the last ping) and
 * dispatch, the patient's tracker and the ER all see the unit move.
 */
export function ManualDrive({
  units,
  fixedUnitId,
  onActiveChange,
}: {
  units: Ambulance[];
  /** Crew console: drive only this unit. Dispatch: let the user pick. */
  fixedUnitId?: string;
  onActiveChange?: (active: boolean) => void;
}) {
  const { socket, connected } = useSocket();
  const [unitId, setUnitId] = useState(fixedUnitId ?? '');
  const unit = units.find((u) => u.id === (fixedUnitId ?? unitId));
  const [driving, setDriving] = useState(false);
  const [topSpeed, setTopSpeed] = useState<number>(60);
  const [car, setCar] = useState<CarState | null>(null);
  const [input, setInput] = useState<CarInput>(NO_INPUT);

  const carRef = useRef<CarState | null>(null);
  const inputRef = useRef<CarInput>({ ...NO_INPUT });
  const lastSent = useRef(0);
  const enterButton = useRef<HTMLButtonElement>(null);

  // Park the car wherever the unit currently is, until we take over.
  useEffect(() => {
    if (!unit || driving) return;
    const parked = { pos: unit.position, heading: unit.heading ?? 0, speed: 0 };
    carRef.current = parked;
    setCar(parked);
  }, [unit, driving]);

  const publish = useCallback(
    (force = false) => {
      const c = carRef.current;
      if (!socket || !connected || !unit || !c) return;
      const now = Date.now();
      if (!force && now - lastSent.current < PUBLISH_MS) return;
      lastSent.current = now;
      socket.emit(
        'location:publish',
        {
          ambulanceId: unit.id,
          lat: c.pos.lat,
          lng: c.pos.lng,
          accuracy: 5,
          heading: Math.round(c.heading) % 360,
          speed: Math.min(100, Math.abs(c.speed)),
        },
        (res) => {
          if (!res.ok) toast.error('Location rejected', { description: res.error });
        },
      );
    },
    [socket, connected, unit],
  );

  const exit = useCallback(() => {
    inputRef.current = { ...NO_INPUT };
    setInput(NO_INPUT);
    if (carRef.current) carRef.current = { ...carRef.current, speed: 0 };
    publish(true);
    setDriving(false);
    setTimeout(() => enterButton.current?.focus(), 0);
  }, [publish]);

  // Keyboard: game controls while in driving mode.
  useEffect(() => {
    if (!driving) return;
    const set = (e: KeyboardEvent, pressed: boolean) => {
      if (e.key === 'Escape' && pressed) return exit();
      const control = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      const boost = e.shiftKey;
      if (isTyping(e.target)) return;
      if (control) e.preventDefault(); // no page scrolling while driving
      if (!control && inputRef.current.boost === boost) return;
      inputRef.current = { ...inputRef.current, boost, ...(control ? { [control]: pressed } : {}) };
      setInput(inputRef.current);
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    const blur = () => {
      inputRef.current = { ...NO_INPUT };
      setInput(NO_INPUT);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [driving, exit]);

  // Game loop.
  useEffect(() => {
    if (!driving) return;
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      const c = carRef.current;
      if (!c) return;
      const next = stepCar(c, inputRef.current, dt, topSpeed);
      const moved = next.speed !== 0 || c.speed !== 0;
      carRef.current = next;
      if (moved || next.heading !== c.heading) setCar(next);
      if (moved) publish(c.speed !== 0 && next.speed === 0); // report the moment we stop
    }, TICK_MS);
    return () => clearInterval(t);
  }, [driving, topSpeed, publish]);

  useEffect(() => onActiveChange?.(driving), [driving, onActiveChange]);

  const teleport = (p: LatLng) => {
    if (!carRef.current) return;
    carRef.current = { ...carRef.current, pos: p, speed: 0 };
    setCar(carRef.current);
    publish(true);
  };

  const enter = () => {
    if (!unit || !connected) return;
    setDriving(true);
    publish(true);
  };

  const kmh = car ? Math.round(Math.abs(car.speed) * 3.6) : 0;
  const gear = !car || Math.abs(car.speed) < 0.3 ? 'N' : car.speed > 0 ? 'D' : 'R';

  return (
    <>
      <Card data-testid="manual-drive" className="py-4">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-sky-500/15 p-2.5 text-sky-600 dark:text-sky-400">
              <CarFront className="size-5" />
            </div>
            <div>
              <p className="flex items-center gap-2 font-medium">
                Manual driving mode <Badge variant="warning">Testing</Badge>
              </p>
              <p className="text-muted-foreground text-sm">Drive {unit ? unit.callsign : 'a unit'} with your keyboard, like a game. Everyone sees it move live.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {!fixedUnitId && (
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Choose an ambulance" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.callsign} · {u.type} · {u.status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Top speed</Label>
              <Select value={String(topSpeed)} onValueChange={(v) => setTopSpeed(Number(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOP_SPEEDS.map((s) => <SelectItem key={s} value={String(s)}>{s} km/h</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button ref={enterButton} onClick={enter} disabled={!unit || !connected} data-testid="manual-drive-enter">
              <CarFront /> {connected ? 'Enter driving mode' : 'Connecting…'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {driving && car && unit &&
        createPortal(
          <div className="fixed inset-0 z-[60] bg-black" role="dialog" aria-modal="true" aria-label={`Driving ${unit.callsign}`} data-testid="driving-mode">
            <LiveMap
              center={car.pos}
              zoom={17}
              follow={car.pos}
              onMapClick={teleport}
              markers={[{ id: 'car', kind: 'ambulance', position: car.pos, heading: car.heading, live: true, tone: 'busy', label: unit.callsign }]}
              className="h-full w-full"
            />

            {/* Top bar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between gap-3 p-4">
              <div className="pointer-events-auto rounded-xl bg-black/70 px-4 py-2 text-white backdrop-blur">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2 animate-pulse rounded-full bg-red-500" /> Driving {unit.callsign}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-white/70">
                  <MousePointerClick className="size-3.5" /> Click the map to jump there
                </p>
              </div>
              <Button className="pointer-events-auto" variant="secondary" onClick={exit}>
                <LogOut /> Exit <kbd className="ml-1 rounded bg-black/10 px-1.5 text-[10px]">Esc</kbd>
              </Button>
            </div>

            {/* Dashboard */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex flex-wrap items-end justify-between gap-4 p-4">
              <div className="rounded-2xl bg-black/75 px-6 py-4 text-white backdrop-blur">
                <div className="flex items-end gap-4">
                  <div>
                    <p className="font-mono text-5xl leading-none font-bold tabular-nums" data-testid="speedometer">{kmh}</p>
                    <p className="text-xs text-white/60">km/h {input.boost && <span className="font-semibold text-amber-400">BOOST</span>}</p>
                  </div>
                  <div className="flex gap-1 pb-1 font-mono text-lg font-bold">
                    {(['R', 'N', 'D'] as const).map((g) => (
                      <span key={g} className={cn('rounded px-1.5', g === gear ? (g === 'R' ? 'bg-red-500' : 'bg-sky-500') : 'text-white/30')}>{g}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 pb-1 text-sm">
                    <Compass className="size-4 text-white/60" style={{ transform: `rotate(${car.heading}deg)` }} />
                    <span className="font-mono">{compassPoint(car.heading)} {Math.round(car.heading)}°</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-white/15">
                  <div className={cn('h-full transition-[width]', input.boost ? 'bg-amber-400' : 'bg-sky-500')} style={{ width: `${Math.min(100, (kmh / (topSpeed * 1.8)) * 100)}%` }} />
                </div>
              </div>

              <div className="hidden rounded-2xl bg-black/75 p-4 text-white backdrop-blur sm:block">
                <div className="flex items-end gap-6">
                  <div className="grid grid-cols-3 gap-1">
                    <span />
                    <KeyCap on={input.throttle}><ArrowUp className="size-4" /></KeyCap>
                    <span />
                    <KeyCap on={input.left}><ArrowLeft className="size-4" /></KeyCap>
                    <KeyCap on={input.brake}><ArrowDown className="size-4" /></KeyCap>
                    <KeyCap on={input.right}><ArrowRight className="size-4" /></KeyCap>
                  </div>
                  <div className="space-y-1">
                    <KeyCap on={input.boost} wide>Shift</KeyCap>
                    <KeyCap on={input.handbrake} wide>Space</KeyCap>
                  </div>
                  <ul className="space-y-0.5 text-xs text-white/70">
                    <li><b className="text-white">↑ / W</b> accelerate</li>
                    <li><b className="text-white">↓ / S</b> brake · reverse</li>
                    <li><b className="text-white">← → / A D</b> steer</li>
                    <li><b className="text-white">Shift</b> boost · <b className="text-white">Space</b> handbrake</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
