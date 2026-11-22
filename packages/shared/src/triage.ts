import type { Severity } from './enums.js';
import type { Vitals } from './schemas.js';

const CRITICAL = [
  'cardiac arrest',
  'not breathing',
  'unconscious',
  'severe bleeding',
  'stroke',
  'seizure',
  'anaphylaxis',
];
const HIGH = [
  'chest pain',
  'difficulty breathing',
  'head injury',
  'burns',
  'fracture',
  'poisoning',
  'road accident',
];
const MODERATE = ['fever', 'vomiting', 'abdominal pain', 'dizziness', 'fall', 'allergic reaction'];

/** Rule-based triage. Pure & deterministic so it can be unit tested and shared with the UI. */
export function triage(symptoms: readonly string[], vitals?: Vitals): Severity {
  const s = symptoms.map((x) => x.toLowerCase().trim());
  const has = (list: string[]) => s.some((sym) => list.some((k) => sym.includes(k)));

  if (vitals) {
    if ((vitals.spo2 !== undefined && vitals.spo2 < 85) || (vitals.gcs !== undefined && vitals.gcs <= 8)) {
      return 'critical';
    }
    if (vitals.heartRate !== undefined && (vitals.heartRate < 40 || vitals.heartRate > 150)) return 'critical';
    if (vitals.systolic !== undefined && vitals.systolic < 80) return 'critical';
  }
  if (has(CRITICAL)) return 'critical';
  if (has(HIGH)) return 'high';
  if (vitals?.spo2 !== undefined && vitals.spo2 < 92) return 'high';
  if (has(MODERATE)) return 'moderate';
  return 'low';
}

const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
export const SYMPTOM_OPTIONS: string[] = [...CRITICAL, ...HIGH, ...MODERATE].map(title);
