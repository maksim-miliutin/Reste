import { MutuelleContract, Situation, computeLine, computeQuote } from '../reimbursement';
import { findAct } from '../tariffs';

const cents = (n: number) => Math.round(n * 100) / 100;

const GP = findAct('G / GS')!;
const CROWN = findAct('HBLD038')!;
const SPEC = findAct('CS')!;

const today: Situation = { date: '2026-07-01', coordinatedPathway: true };

const basic: MutuelleContract = {
  name: 'Basique 100 %',
  responsible: true,
  coverage: {
    consultation: { kind: 'percentOfBase', percent: 100 },
    specialist: { kind: 'percentOfBase', percent: 100 },
    dental: { kind: 'percentOfBase', percent: 100 },
  },
};

const strong: MutuelleContract = {
  name: 'Confort 300 %',
  responsible: true,
  coverage: {
    consultation: { kind: 'percentOfBase', percent: 200 },
    specialist: { kind: 'percentOfBase', percent: 200 },
    dental: { kind: 'percentOfBase', percent: 300 },
    optical: { kind: 'flatEuro', amount: 200 },
  },
};

describe('official ameli example: €30 GP in secteur 1', () => {
  // Source: €30 consultation, Sécu reimburses 70% = €21,
  // minus the €2 participation forfaitaire → €19 back.
  it('leaves €11 out of pocket without an insurer', () => {
    const r = computeLine({ act: GP, charged: 30, sector: 'secteur1' }, null, today);
    expect(r.base).toBe(30);
    expect(r.securiteSociale).toBe(19);
    expect(r.restACharge).toBe(11);
  });

  it('with 100% cover exactly the participation remains', () => {
    const r = computeLine({ act: GP, charged: 30, sector: 'secteur1' }, basic, today);
    expect(r.securiteSociale).toBe(19);
    expect(r.mutuelle).toBe(9); // ticket modérateur
    expect(r.restACharge).toBe(2); // participation, cannot be covered
  });
});

describe('participation forfaitaire', () => {
  it('changes by date: €1 before May 2024, €2 after', () => {
    const before = computeLine(
      { act: GP, charged: 26.5, sector: 'secteur1' },
      null,
      { date: '2024-01-10', coordinatedPathway: true },
    );
    const after = computeLine({ act: GP, charged: 30, sector: 'secteur1' }, null, today);
    // 26.50 × 70% = 18.55, minus €1 = 17.55
    expect(before.securiteSociale).toBe(17.55);
    expect(after.securiteSociale).toBe(19);
  });

  it('is not charged to exempt users', () => {
    const r = computeLine(
      { act: GP, charged: 30, sector: 'secteur1' },
      basic,
      { ...today, exemptFromParticipation: true },
    );
    expect(r.restACharge).toBe(0);
  });
});

describe('the base matters more than the percentage', () => {
  // The core trap: "70% reimbursed" is 70% of a €120 base,
  // not of the €800 price.
  it('an €800 crown is reimbursed from a €120 base, not the price', () => {
    const r = computeLine({ act: CROWN, charged: 800, sector: 'secteur1' }, null, today);
    expect(r.base).toBe(120);
    expect(r.securiteSociale).toBe(84); // 120 × 70 %
    expect(r.overrun).toBe(680); // this is what nobody expects
    expect(r.restACharge).toBe(716);
  });

  it('even 300% cover does not close the gap', () => {
    const r = computeLine({ act: CROWN, charged: 800, sector: 'secteur1' }, strong, today);
    // Cap 300% × 120 = 360, of which Sécu already paid 84 → insurer 276
    expect(r.mutuelle).toBe(276);
    expect(r.restACharge).toBe(440);
  });
});

describe('doctor sector', () => {
  it('secteur 2 without OPTAM is reimbursed from a reduced €23 base', () => {
    const optam = computeLine({ act: SPEC, charged: 60, sector: 'secteur2_optam' }, null, today);
    const plain = computeLine({ act: SPEC, charged: 60, sector: 'secteur2' }, null, today);
    expect(optam.base).toBe(31.5);
    expect(plain.base).toBe(23);
    expect(plain.securiteSociale).toBeLessThan(optam.securiteSociale);
  });

  it('the overrun falls entirely on patient and insurer', () => {
    const r = computeLine({ act: SPEC, charged: 70, sector: 'secteur2_optam' }, null, today);
    expect(r.overrun).toBe(38.5); // 70 − 31.50
  });
});

describe('parcours de soins', () => {
  it('going outside the pathway drops the rate to 30%', () => {
    const inside = computeLine({ act: SPEC, charged: 31.5, sector: 'secteur1' }, null, today);
    const outside = computeLine(
      { act: SPEC, charged: 31.5, sector: 'secteur1' },
      null,
      { ...today, coordinatedPathway: false },
    );
    expect(outside.securiteSociale).toBeLessThan(inside.securiteSociale);
    expect(outside.restACharge).toBeGreaterThan(inside.restACharge);
  });
});

describe('full coverage (ALD, CSS, pregnancy)', () => {
  it('reimburses 100% of the base but not the overrun', () => {
    const r = computeLine(
      { act: SPEC, charged: 60, sector: 'secteur2_optam' },
      null,
      { ...today, fullCoverage: true, exemptFromParticipation: true },
    );
    expect(r.securiteSociale).toBe(31.5); // the whole base
    expect(r.restACharge).toBe(28.5); // the overrun remains
  });
});

describe('calculation invariants', () => {
  const cases = [
    { act: GP, charged: 30, sector: 'secteur1' as const },
    { act: SPEC, charged: 90, sector: 'secteur2' as const },
    { act: CROWN, charged: 1200, sector: 'secteur1' as const },
    { act: GP, charged: 0, sector: 'secteur1' as const },
  ];

  it('reimbursements never exceed what was charged', () => {
    for (const c of cases) {
      for (const contract of [null, basic, strong]) {
        const r = computeLine(c, contract, today);
        expect(r.securiteSociale + r.mutuelle).toBeLessThanOrEqual(r.charged + 0.01);
      }
    }
  });

  it('out-of-pocket is never negative', () => {
    for (const c of cases) {
      for (const contract of [null, basic, strong]) {
        expect(computeLine(c, contract, today).restACharge).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('the parts add up to the charged total', () => {
    for (const c of cases) {
      const r = computeLine(c, strong, today);
      const total = r.securiteSociale + r.mutuelle + r.restACharge;
      expect(Math.abs(total - r.charged)).toBeLessThan(0.02);
    }
  });

  it('every calculation step is exposed', () => {
    const r = computeLine({ act: CROWN, charged: 800, sector: 'secteur1' }, strong, today);
    const keys = r.steps.map((s) => s.key);
    expect(keys).toContain('base');
    expect(keys).toContain('securiteSociale');
    expect(keys).toContain('mutuelle');
    expect(keys).toContain('overrun');
  });

  it('base and rate carry a source reference', () => {
    const r = computeLine({ act: GP, charged: 30, sector: 'secteur1' }, null, today);
    expect(r.steps.find((s) => s.key === 'base')?.source).toBeTruthy();
    expect(r.steps.find((s) => s.key === 'securiteSociale')?.source).toBeTruthy();
  });
});

describe('whole quote', () => {
  it('sums the lines', () => {
    const q = computeQuote(
      [
        { act: GP, charged: 30, sector: 'secteur1' },
        { act: CROWN, charged: 800, sector: 'secteur1' },
      ],
      basic,
      today,
    );
    expect(q.charged).toBe(830);
    expect(q.lines.length).toBe(2);
    expect(Math.abs(q.securiteSociale + q.mutuelle + q.restACharge - q.charged)).toBeLessThan(0.02);
  });

  it('accounts for quantity', () => {
    const one = computeQuote([{ act: GP, charged: 30, sector: 'secteur1' }], basic, today);
    const three = computeQuote(
      [{ act: GP, charged: 30, sector: 'secteur1', quantity: 3 }],
      basic,
      today,
    );
    expect(three.charged).toBe(cents(one.charged * 3));
  });
});

describe('base read from the document', () => {
  it('the devis base wins over the catalogue', () => {
    // Devis печатает свою базу — она точнее нашего каталога.
    const r = computeLine(
      { act: CROWN, charged: 800, sector: 'secteur1', baseOverride: 107.5 },
      null,
      today,
    );
    expect(r.base).toBe(107.5);
    expect(r.securiteSociale).toBe(75.25);
  });

  it('computes an act missing from the catalogue', () => {
    const r = computeLine(
      {
        charged: 450,
        sector: 'secteur1',
        baseOverride: 75,
        rateOverride: 0.7,
        labelOverride: 'Acte inconnu',
        category: 'dental',
      },
      basic,
      today,
    );
    expect(r.label).toBe('Acte inconnu');
    expect(r.securiteSociale).toBe(52.5);
    expect(r.restACharge).toBe(375);
  });

  it('invents no reimbursement without base or catalogue', () => {
    const r = computeLine({ charged: 200, sector: 'secteur1' }, basic, today);
    expect(r.base).toBe(0);
    expect(r.securiteSociale).toBe(0);
    expect(r.restACharge).toBe(200);
  });

  it('marks the base source as the devis', () => {
    const r = computeLine(
      { act: CROWN, charged: 800, sector: 'secteur1', baseOverride: 107.5 },
      null,
      today,
    );
    expect(r.steps.find((s) => s.key === 'base')?.source).toBe('devis');
  });
});
