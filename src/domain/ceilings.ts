import { MutuelleContract } from './reimbursement';
import { CareCategory } from './tariffs';

/**
 * Annual caps: what is left and when it resets.
 *
 * French insurers reset limits once a year and unused amounts do not carry
 * over. The "year" is not always the calendar year — some contracts count from
 * the signature date, so the reset point comes from the contract.
 *
 * Tone is part of the logic: these are medical costs, not a sale. The reminder
 * states the deadline without suggesting the limit should be spent.
 */

export interface CeilingStatus {
  category: CareCategory;
  ceiling: number;
  used: number;
  remaining: number;
  ratio: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Start of the current cap year — calendar or contract-based. */
export function ceilingYearStart(contract: MutuelleContract | null, now = new Date()): string {
  const mmdd = contract?.ceilingYearStart ?? '01-01';
  const [m, d] = mmdd.split('-').map(Number);
  const thisYear = new Date(now.getFullYear(), (m || 1) - 1, d || 1);
  // If this year's reset is still ahead, the period started a year ago.
  if (thisYear > now) thisYear.setFullYear(thisYear.getFullYear() - 1);
  return iso(thisYear);
}

/** Next reset date. */
export function ceilingResetDate(contract: MutuelleContract | null, now = new Date()): string {
  const [y, m, d] = ceilingYearStart(contract, now).split('-').map(Number);
  return iso(new Date(y + 1, m - 1, d));
}

export function daysUntilReset(contract: MutuelleContract | null, now = new Date()): number {
  const [y, m, d] = ceilingResetDate(contract, now).split('-').map(Number);
  const reset = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((reset.getTime() - today.getTime()) / 86_400_000));
}

export function ceilingStatuses(
  contract: MutuelleContract | null,
  consumed: Partial<Record<CareCategory, number>>,
): CeilingStatus[] {
  const caps = contract?.annualCeiling;
  if (!caps) return [];

  return (Object.entries(caps) as [CareCategory, number][])
    .filter(([, ceiling]) => ceiling > 0)
    .map(([category, ceiling]) => {
      const used = Math.max(0, consumed[category] ?? 0);
      const remaining = Math.round(Math.max(0, ceiling - used) * 100) / 100;
      return { category, ceiling, used, remaining, ratio: Math.min(1, used / ceiling) };
    })
    .sort((a, b) => b.remaining - a.remaining);
}

/** Below this amount the remainder cannot cover a real act. */
const MEANINGFUL = 50;
/** Mention the deadline a quarter ahead; earlier is just noise. */
const WINDOW_DAYS = 92;

export interface ExpiryNotice {
  daysLeft: number;
  resetDate: string;
  statuses: CeilingStatus[];
  total: number;
}

export function expiryNotice(
  contract: MutuelleContract | null,
  consumed: Partial<Record<CareCategory, number>>,
  now = new Date(),
): ExpiryNotice | null {
  const daysLeft = daysUntilReset(contract, now);
  if (daysLeft > WINDOW_DAYS) return null;

  const statuses = ceilingStatuses(contract, consumed).filter((s) => s.remaining >= MEANINGFUL);
  if (statuses.length === 0) return null;

  return {
    daysLeft,
    resetDate: ceilingResetDate(contract, now),
    statuses,
    total: Math.round(statuses.reduce((sum, s) => sum + s.remaining, 0) * 100) / 100,
  };
}
