import { compareScenarios, hasZeroRacOption } from '../compare';
import { MutuelleContract, Situation } from '../reimbursement';
import { findAct } from '../tariffs';

const CROWN = findAct('HBLD038')!;
const GP = findAct('G / GS')!;
const today: Situation = { date: '2026-07-01', coordinatedPathway: true };

const contract: MutuelleContract = {
  name: 'Responsable 300 %',
  responsible: true,
  coverage: {
    dental: { kind: 'percentOfBase', percent: 300 },
    consultation: { kind: 'percentOfBase', percent: 100 },
  },
};

describe('hasZeroRacOption', () => {
  it('a zero-out-of-pocket basket exists for dental and optical', () => {
    expect(hasZeroRacOption(['dental'])).toBe(true);
    expect(hasZeroRacOption(['optical'])).toBe(true);
    expect(hasZeroRacOption(['consultation'])).toBe(false);
  });
});

describe('compareScenarios', () => {
  const line = { act: CROWN, charged: 800, sector: 'secteur1' as const, baseOverride: 120 };

  it('always returns the original quote first', () => {
    const s = compareScenarios([line], contract, today);
    expect(s[0].key).toBe('quote');
    expect(s[0].deltaVsQuote).toBe(0);
  });

  it('the 100% Santé option is markedly cheaper', () => {
    const [quote, zero] = compareScenarios([line], contract, today);
    expect(zero.key).toBe('zeroRac');
    expect(zero.result.restACharge).toBeLessThan(quote.result.restACharge);
    expect(zero.deltaVsQuote).toBeLessThan(0);
  });

  it('the 100% Santé basket has no overrun', () => {
    const [, zero] = compareScenarios([line], contract, today);
    expect(zero.result.lines[0].overrun).toBe(0);
  });

  it('does not offer the basket where none exists', () => {
    const s = compareScenarios([{ act: GP, charged: 30, sector: 'secteur1' }], contract, today);
    expect(s.map((x) => x.key)).toEqual(['quote']);
  });

  it('does not model the basket without a known base', () => {
    const s = compareScenarios(
      [{ act: undefined, charged: 800, sector: 'secteur1', category: 'dental' }],
      contract,
      today,
    );
    // the line stays as-is, no saving appears
    expect(s[1].deltaVsQuote).toBe(0);
  });

  it('computes a custom price when the user sets one', () => {
    const s = compareScenarios([line], contract, today, [500]);
    const custom = s.find((x) => x.key === 'custom');
    expect(custom).toBeDefined();
    expect(custom!.result.charged).toBe(500);
    expect(custom!.deltaVsQuote).toBeLessThan(0);
  });

  it('ignores custom prices when the count does not match', () => {
    const s = compareScenarios([line], contract, today, [500, 600]);
    expect(s.find((x) => x.key === 'custom')).toBeUndefined();
  });

  it('accounts for the annual cap in all scenarios', () => {
    const capped: MutuelleContract = { ...contract, annualCeiling: { dental: 100 } };
    const [quote, zero] = compareScenarios([line], capped, {
      ...today,
      consumedThisYear: { dental: 100 },
    });
    expect(quote.result.mutuelle).toBe(0);
    expect(zero.result.mutuelle).toBe(0);
  });
});
