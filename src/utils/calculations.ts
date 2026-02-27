import { format, formatDistanceToNow, parseISO, isToday, isYesterday } from 'date-fns';

// ── ID generation ────────────────────────────────────────────────────────────

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

// ── Date formatting ──────────────────────────────────────────────────────────

export function relativeDate(isoString: string): string {
  try {
    const date = parseISO(isoString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return isoString;
  }
}

export function formatDate(isoString: string): string {
  try {
    return format(parseISO(isoString), 'MMM d, yyyy');
  } catch {
    return isoString;
  }
}

export function formatShortDate(isoString: string): string {
  try {
    return format(parseISO(isoString), 'MMM d');
  } catch {
    return isoString;
  }
}

// ── Duration formatting ──────────────────────────────────────────────────────

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return '0:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatRestTimer(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Strength calculations ────────────────────────────────────────────────────

/** Epley formula: 1RM = weight × (1 + reps / 30) */
export function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Calculate volume for a set of reps */
export function setVolume(weight: number, reps: number): number {
  return weight * reps;
}

// ── Plate calculator ─────────────────────────────────────────────────────────

export interface PlateResult {
  perSide: Array<{ weight: number; count: number }>;
  remainder: number;
}

const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export function calculatePlates(
  totalKg: number,
  barWeightKg = 20
): PlateResult {
  let remaining = (totalKg - barWeightKg) / 2;
  const perSide: Array<{ weight: number; count: number }> = [];

  for (const plate of STANDARD_PLATES_KG) {
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      perSide.push({ weight: plate, count });
      remaining -= count * plate;
    }
  }

  return { perSide, remainder: Math.round(remaining * 100) / 100 };
}

// ── Macro helpers ────────────────────────────────────────────────────────────

export function sumMacros(items: Array<{
  kcal: number; protein_g: number; carbs_g: number; fat_g: number;
}>) {
  return items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + (i.kcal ?? 0),
      protein_g: acc.protein_g + (i.protein_g ?? 0),
      carbs_g: acc.carbs_g + (i.carbs_g ?? 0),
      fat_g: acc.fat_g + (i.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}
