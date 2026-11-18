import { describe, expect, it } from 'vitest';
import { formatDistance, formatEta, humanize, initials } from '@/lib/utils';

describe('formatters', () => {
  it('formats ETA', () => {
    expect(formatEta(undefined)).toBe('—');
    expect(formatEta(0)).toBe('Arrived');
    expect(formatEta(45)).toBe('45s');
    expect(formatEta(600)).toBe('10 min');
    expect(formatEta(3900)).toBe('1h 5m');
  });
  it('formats distance', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(2350)).toBe('2.4 km');
  });
  it('initials strip honorifics', () => {
    expect(initials('Dr. Ananya Rao')).toBe('AR');
    expect(initials(undefined)).toBe('?');
  });
  it('humanizes enums', () => expect(humanize('en_route')).toBe('En Route'));
});
