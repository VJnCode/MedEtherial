import { describe, expect, it } from 'vitest';
import { canTransition, hasPermission, haversine, primaryRole, triage } from './index.js';

describe('rbac', () => {
  it('grants admin everything', () => expect(hasPermission(['admin'], 'user:manage')).toBe(true));
  it('denies patient dispatch', () => expect(hasPermission(['patient'], 'incident:dispatch')).toBe(false));
  it('ignores unknown roles', () => expect(hasPermission(['offline_access'], 'hospital:read')).toBe(false));
  it('primary role picks highest', () => expect(primaryRole(['patient', 'doctor'])).toBe('doctor'));
});

describe('incident state machine', () => {
  it('allows forward', () => expect(canTransition('assigned', 'en_route')).toBe(true));
  it('blocks skipping', () => expect(canTransition('requested', 'transporting')).toBe(false));
  it('closed is terminal', () => expect(canTransition('closed', 'requested')).toBe(false));
});

describe('triage', () => {
  it('critical on keyword', () => expect(triage(['Cardiac Arrest'])).toBe('critical'));
  it('critical on vitals', () => expect(triage(['fever'], { spo2: 80 })).toBe('critical'));
  it('high', () => expect(triage(['chest pain'])).toBe('high'));
  it('moderate', () => expect(triage(['fever'])).toBe('moderate'));
  it('low', () => expect(triage(['rash'])).toBe('low'));
});

describe('geo', () => {
  it('haversine Mysuru palace to railway station is about 1.5–2.5 km', () => {
    const d = haversine({ lat: 12.3052, lng: 76.6552 }, { lat: 12.3162, lng: 76.6448 });
    expect(d).toBeGreaterThan(1500);
    expect(d).toBeLessThan(2500);
  });
});
