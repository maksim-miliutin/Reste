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

describe('insurer annual cap', () => {
  const capped: MutuelleContract = {
    name: 'Dentaire plafonné',
    responsible: true,
    coverage: { dental: { kind: 'percentOfBase', percent: 300 } },
    annualCeiling: { dental: 400 },
  };

  it('does not cut the payout until the cap is reached', () => {
    const r = computeLine({ act: CROWN, charged: 800, sector: 'secteur1' }, capped, today);
    expect(r.mutuelle).toBe(276); // same as without a cap
    expect(r.cappedByCeiling).toBe(0);
  });

  it('trims the payout when the year is already spent', () => {
    const r = computeLine({ act: CROWN, charged: 800, sector: 'secteur1' }, capped, {
      ...today,
      consumedThisYear: { dental: 250 },
    });
    expect(r.mutuelle).toBe(150); // 400 − 250 left
    expect(r.cappedByCeiling).toBe(126);
    expect(r.restACharge).toBe(566);
  });

  it('an exhausted cap zeroes the insurer share', () => {
    const r = computeLine({ act: CROWN, charged: 800, sector: 'secteur1' }, capped, {
      ...today,
      consumedThisYear: { dental: 400 },
    });
    expect(r.mutuelle).toBe(0);
    expect(r.restACharge).toBe(716); // as if there were no insurer at all
  });

  it('one category cap does not affect another', () => {
    const mixed: MutuelleContract = {
      ...capped,
      coverage: { ...capped.coverage, consultation: { kind: 'percentOfBase', percent: 100 } },
    };
    const r = computeLine({ act: GP, charged: 30, sector: 'secteur1' }, mixed, {
      ...today,
      consumedThisYear: { dental: 400 },
    });
    expect(r.mutuelle).toBe(9);
  });

  it('tells the user the cap was applied', () => {
    const r = computeLine({ act: CROWN, charged: 800, sector: 'secteur1' }, capped, {
      ...today,
      consumedThisYear: { dental: 300 },
    });
    const step = r.steps.find((s) => s.key === 'ceiling');
    expect(step).toBeDefined();
    expect(step?.detail?.ceiling).toBe(400);
  });
});

describe('the annual cap is shared across the quote, not per line', () => {
  const capped: MutuelleContract = {
    name: 'Confort 300 % / 400 € dentaire',
    responsible: true,
    coverage: { dental: { kind: 'percentOfBase', percent: 300 } },
    annualCeiling: { dental: 400 },
  };

  it('two crowns in one devis do not each get the full cap', () => {
    // 300 % от базы 120 € = 360 €, минус доля Sécu 84 € → 276 € на коронку.
    // €400/year cap: the first takes €276, leaving €124 for the second.
    const q = computeQuote(
      [
        { act: CROWN, charged: 800, sector: 'secteur1' },
        { act: CROWN, charged: 800, sector: 'secteur1' },
      ],
      capped,
      today,
    );
    expect(q.lines[0].mutuelle).toBe(276);
    expect(q.lines[1].mutuelle).toBe(124);
    expect(q.mutuelle).toBe(400);
    expect(q.lines[1].cappedByCeiling).toBe(152);
  });

  it('a line computed alone knows nothing of its neighbours', () => {
    const alone = computeLine({ act: CROWN, charged: 800, sector: 'secteur1' }, capped, today);
    const inQuote = computeQuote(
      [
        { act: CROWN, charged: 800, sector: 'secteur1' },
        { act: CROWN, charged: 800, sector: 'secteur1' },
      ],
      capped,
      today,
    );
    expect(alone.mutuelle).toBe(276);
    expect(inQuote.mutuelle).toBeLessThan(cents(alone.mutuelle * 2));
  });

  it('yearly consumption is deducted before the first line', () => {
    const q = computeQuote([{ act: CROWN, charged: 800, sector: 'secteur1' }], capped, {
      ...today,
      consumedThisYear: { dental: 350 },
    });
    expect(q.lines[0].mutuelle).toBe(50);
    expect(q.lines[0].cappedByCeiling).toBe(226);
  });
});

describe('daily cap on deductions', () => {
  it('five consultations in one day cost €8, not €10', () => {
    const q = computeQuote(
      Array.from({ length: 5 }, () => ({ act: GP, charged: 30, sector: 'secteur1' as const })),
      null,
      today,
    );
    const total = cents(q.lines.reduce((a, l) => a + l.participation, 0));
    expect(total).toBe(8);
    expect(q.securiteSociale).toBe(97); // 5 × 21 − 8
  });

  it('the cap applies within a single line with quantity', () => {
    const q = computeQuote([{ act: GP, charged: 30, sector: 'secteur1', quantity: 5 }], null, today);
    expect(q.lines[0].participation).toBe(8);
    expect(q.securiteSociale).toBe(97);
  });

  it('the step reports that the cap applied', () => {
    const q = computeQuote([{ act: GP, charged: 30, sector: 'secteur1', quantity: 5 }], null, today);
    const step = q.lines[0].steps.find((s) => s.key === 'participation');
    expect(step?.detail?.dailyCap).toBe(8);
  });
});

describe('an unknown base differs from a zero base', () => {
  it('marks the line as uncomputable without code or base', () => {
    const q = computeQuote(
      [{ charged: 500, sector: 'secteur1', category: 'dental', labelOverride: 'Implant' }],
      basic,
      today,
    );
    expect(q.lines[0].baseKnown).toBe(false);
    expect(q.unknownLines).toBe(1);
    expect(q.lines[0].restACharge).toBe(500);
  });

  it('a zero base from the document is known, not missing', () => {
    const q = computeQuote(
      [{ charged: 500, sector: 'secteur1', category: 'dental', baseOverride: 0 }],
      basic,
      today,
    );
    expect(q.lines[0].baseKnown).toBe(true);
    expect(q.unknownLines).toBe(0);
  });

  it('act exists but no tariff was in force on that date', () => {
    const r = computeLine({ act: GP, charged: 30, sector: 'secteur1' }, null, {
      date: '2010-01-01',
      coordinatedPathway: true,
    });
    expect(r.baseKnown).toBe(false);
  });
});

describe('ALD does not exempt from the participation forfaitaire', () => {
  it('100% reimbursement but the €2 still applies', () => {
    const r = computeLine({ act: GP, charged: 30, sector: 'secteur1' }, null, {
      date: '2026-07-01',
      coordinatedPathway: true,
      fullCoverage: true,
    });
    expect(r.securiteSociale).toBe(28);
    expect(r.restACharge).toBe(2);
  });

  it('exemption is separate: CSS, AME, minors, pregnancy 6+', () => {
    const r = computeLine({ act: GP, charged: 30, sector: 'secteur1' }, null, {
      date: '2026-07-01',
      coordinatedPathway: true,
      fullCoverage: true,
      exemptFromParticipation: true,
    });
    expect(r.securiteSociale).toBe(30);
    expect(r.restACharge).toBe(0);
  });
});
