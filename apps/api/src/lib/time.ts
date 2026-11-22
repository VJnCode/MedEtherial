/** Minutes east of UTC for `timeZone` at instant `date`. */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** Converts a wall-clock time (YYYY-MM-DD + HH:mm) in `timeZone` to a UTC Date. */
export function zonedToUtc(dateStr: string, hhmm: string, timeZone: string): Date {
  const guess = new Date(`${dateStr}T${hhmm}:00Z`);
  const off = tzOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - off * 60_000);
}

/** Day of week (0=Sun) of a YYYY-MM-DD calendar date. */
export function dayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Calendar date (YYYY-MM-DD) of an instant in a timezone. */
export function zonedDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function zonedHHmm(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}
