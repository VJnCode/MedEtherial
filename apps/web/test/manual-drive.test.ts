import { haversine } from '@medetherial/shared';
import { describe, expect, it } from 'vitest';
import { NO_INPUT, compassPoint, offset, stepCar, type CarState } from '@/components/app/manual-drive';

const start: CarState = { pos: { lat: 12.2958, lng: 76.6394 }, heading: 0, speed: 0 };
const run = (car: CarState, input: Partial<typeof NO_INPUT>, seconds: number, maxKmh = 60) => {
  let c = car;
  for (let t = 0; t < seconds; t += 0.05) c = stepCar(c, { ...NO_INPUT, ...input }, 0.05, maxKmh);
  return c;
};

describe('manual drive physics', () => {
  it('moves the requested distance in the requested direction', () => {
    const east = offset(start.pos, 90, 100);
    expect(haversine(start.pos, east)).toBeCloseTo(100, 0);
    expect(east.lng).toBeGreaterThan(start.pos.lng);
  });

  it('accelerates up to the top speed and drives forward', () => {
    const car = run(start, { throttle: true }, 10);
    expect(car.speed * 3.6).toBeCloseTo(60, 0);
    expect(car.pos.lat).toBeGreaterThan(start.pos.lat); // heading 0 = north
  });

  it('boost raises the top speed', () => {
    expect(run(start, { throttle: true, boost: true }, 10).speed * 3.6).toBeGreaterThan(100);
  });

  it('brakes to a stop, then reverses', () => {
    const fast = run(start, { throttle: true }, 5);
    // 60 km/h ≈ 16.7 m/s at 9 m/s² ≈ 1.85 s to stop; holding brake longer engages reverse.
    const stopped = run(fast, { brake: true }, 1.85);
    expect(Math.abs(stopped.speed)).toBeLessThan(0.5);
    const reversing = run(stopped, { brake: true }, 3);
    expect(reversing.speed).toBeLessThan(0);
  });

  it('coasts to a halt with no input', () => {
    expect(run(run(start, { throttle: true }, 3), {}, 15).speed).toBe(0);
  });

  it('cannot steer while stopped, but turns once moving', () => {
    expect(run(start, { right: true }, 2).heading).toBe(0);
    const turning = run(run(start, { throttle: true }, 3), { throttle: true, right: true }, 1);
    expect(turning.heading).toBeGreaterThan(30);
    expect(turning.heading).toBeLessThan(180);
  });

  it('names compass points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(95)).toBe('E');
    expect(compassPoint(350)).toBe('N');
  });
});
