import {
  ceilingResetDate, ceilingStatuses, ceilingYearStart, daysUntilReset, expiryNotice,
} from '../ceilings';
import { MutuelleContract } from '../reimbursement';

const calendar: MutuelleContract = {
  name: 'Calendrier',
  responsible: true,
  coverage: { dental: { kind: 'percentOfBase', percent: 300 } },
  annualCeiling: { dental: 400, optical: 200 },
};

/** Contract with a July cap year — happens when tied to the signature date. */
const july: MutuelleContract = { ...calendar, ceilingYearStart: '07-01' };

describe('cap year', () => {
  it('defaults to the calendar year', () => {
    expect(ceilingYearStart(calendar, new Date(2026, 5, 15))).toBe('2026-01-01');
    expect(ceilingResetDate(calendar, new Date(2026, 5, 15))).toBe('2027-01-01');
  });

  it('respects the contract date', () => {
    // 15 June: the year started on 1 July last year, reset is close.
    expect(ceilingYearStart(july, new Date(2026, 5, 15))).toBe('2025-07-01');
    expect(ceilingResetDate(july, new Date(2026, 5, 15))).toBe('2026-07-01');
  });

  it('switches period right after the reset date', () => {
    expect(ceilingYearStart(july, new Date(2026, 6, 2))).toBe('2026-07-01');
  });

  it('counts days until reset', () => {
    expect(daysUntilReset(calendar, new Date(2026, 11, 1))).toBe(31);
    expect(daysUntilReset(july, new Date(2026, 5, 1))).toBe(30);
  });
});

describe('ceilingStatuses', () => {
  it('computes the remainder per category', () => {
    const dental = ceilingStatuses(calendar, { dental: 150 }).find((x) => x.category === 'dental')!;
    expect(dental.remaining).toBe(250);
    expect(dental.ratio).toBeCloseTo(0.375, 3);
  });

  it('never goes negative when overspent', () => {
    const dental = ceilingStatuses(calendar, { dental: 900 }).find((x) => x.category === 'dental')!;
    expect(dental.remaining).toBe(0);
    expect(dental.ratio).toBe(1);
  });

  it('empty when there are no caps', () => {
    expect(ceilingStatuses(null, {})).toEqual([]);
    expect(ceilingStatuses({ ...calendar, annualCeiling: undefined }, {})).toEqual([]);
  });

  it('sorts by remaining amount', () => {
    expect(ceilingStatuses(calendar, { dental: 350 })[0].category).toBe('optical');
  });
});

describe('expiryNotice', () => {
  it('stays silent at the start of the period', () => {
    expect(expiryNotice(calendar, {}, new Date(2026, 5, 1))).toBeNull();
  });

  it('warns near the end of the period', () => {
    const n = expiryNotice(calendar, { dental: 100 }, new Date(2026, 11, 1));
    expect(n).not.toBeNull();
    expect(n!.total).toBe(500);
    expect(n!.resetDate).toBe('2027-01-01');
  });

  it('fires on time for a non-calendar contract', () => {
    // June: end of period for a July contract, not for a calendar one.
    const june = new Date(2026, 5, 1);
    expect(expiryNotice(calendar, {}, june)).toBeNull();
    expect(expiryNotice(july, {}, june)).not.toBeNull();
  });

  it('does not warn over cents', () => {
    const n = expiryNotice(
      { ...calendar, annualCeiling: { dental: 400 } },
      { dental: 380 },
      new Date(2026, 11, 1),
    );
    expect(n).toBeNull();
  });

  it('stays silent with exhausted caps and no contract', () => {
    expect(expiryNotice(calendar, { dental: 400, optical: 200 }, new Date(2026, 11, 1))).toBeNull();
    expect(expiryNotice(null, {}, new Date(2026, 11, 1))).toBeNull();
  });
});
