import { matchLine, matchQuote } from '../matching';

const date = '2026-07-01';

describe('matchLine', () => {
  it('confirms the line when document and catalogue agree', () => {
    const m = matchLine({ code: 'HBLD038', label: 'Couronne', charged: 800, base: 120 }, 'secteur1', date);
    expect(m.status).toBe('confirmed');
    expect(m.referenceBase).toBe(120);
  });

  it('flags a mismatch when the doctor states another base', () => {
    const m = matchLine({ code: 'HBLD038', label: 'Couronne', charged: 800, base: 90 }, 'secteur1', date);
    expect(m.status).toBe('mismatch');
    expect(m.referenceBase).toBe(120);
    expect(m.input.baseOverride).toBe(90); // still computed from the document
  });

  it('takes the document base when the code is unknown', () => {
    const m = matchLine({ code: 'HBQK999', label: 'Acte rare', charged: 300, base: 60 }, 'secteur1', date);
    expect(m.status).toBe('documentOnly');
    expect(m.input.act).toBeUndefined();
    expect(m.input.labelOverride).toBe('Acte rare');
  });

  it('admits the reimbursement is unknown without code or base', () => {
    const m = matchLine({ label: 'Soin non codé', charged: 150 }, 'secteur1', date);
    expect(m.status).toBe('unknown');
    expect(m.input.baseOverride).toBeUndefined();
  });

  it('falls back to the catalogue when the document omits the base', () => {
    const m = matchLine({ code: 'G / GS', label: 'Consultation', charged: 30 }, 'secteur1', date);
    expect(m.status).toBe('confirmed');
    expect(m.input.act).toBeDefined();
  });

  it('normalises code case', () => {
    expect(matchLine({ code: 'hbld038', label: 'x', charged: 100 }, 'secteur1', date).input.act).toBeDefined();
  });

  it('never lets quantity drop below one', () => {
    const m = matchLine({ code: 'G / GS', label: 'x', charged: 30, quantity: 0 }, 'secteur1', date);
    expect(m.input.quantity).toBe(1);
  });
});

describe('matchQuote', () => {
  it('parses a whole quote', () => {
    const rows = matchQuote(
      [
        { code: 'HBLD038', label: 'Couronne', charged: 800, base: 120 },
        { code: 'INCONNU', label: 'Autre', charged: 200, base: 40 },
        { label: 'Sans code', charged: 90 },
      ],
      'secteur1',
      date,
    );
    expect(rows.map((r) => r.status)).toEqual(['confirmed', 'documentOnly', 'unknown']);
  });
});
