import {
  ActTariff,
  CareCategory,
  FRANCHISE_DAILY_CAP,
  FRANCHISE_MEDICAMENT,
  PARTICIPATION_DAILY_CAP,
  PARTICIPATION_FORFAITAIRE,
  RATE_OUTSIDE_PATHWAY,
  Sector,
  valueOn,
} from './tariffs';

/**
 * Out-of-pocket calculation.
 *
 * French cover is quoted as a percentage of a *reimbursement base*, not of the
 * price. An €800 crown has a €120 base: the state pays €84, not €560.
 *
 * Returns every intermediate step so the UI can show the arithmetic.
 * Estimate only — the contract and the insurer decide the real number.
 */

/** Insurer cover for a care category. */
export type Coverage =
  /** Percentage of the reimbursement base. 100% covers the ticket modérateur only. */
  | { kind: 'percentOfBase'; percent: number }
  /** Flat euro cap per act — common for optical and dental. */
  | { kind: 'flatEuro'; amount: number }
  /** Not covered. */
  | { kind: 'none' };

export interface MutuelleContract {
  name: string;
  /**
   * Annual payout caps per category, in euros.
   *
   * A contract can promise "300% BR on dental" and still cap it at €400/year —
   * the second crown is then barely covered.
   */
  annualCeiling?: Partial<Record<CareCategory, number>>;
  /**
   * Start of the cap year as MM-DD. Defaults to the calendar year, but some
   * contracts count from the signature date.
   */
  ceilingYearStart?: string;
  /** Missing category means not covered. */
  coverage: Partial<Record<CareCategory, Coverage>>;
  /**
   * Contrat responsable — the vast majority. By law these cannot cover the
   * participation forfaitaire or the medical franchise.
   */
  responsible: boolean;
}

export interface LineInput {
  /** Known act from the catalogue. Absent when the code is unrecognised. */
  act?: ActTariff;
  /** Price actually charged, in euros. */
  charged: number;
  sector: Sector;
  quantity?: number;
  /**
   * Reimbursement base read from the devis itself.
   *
   * Dental and optical quotes must print it by law — more accurate than our
   * catalogue and covers codes we don't have. Wins over the catalogue.
   */
  baseOverride?: number;
  /** Label from the document when the act is not in the catalogue. */
  labelOverride?: string;
  category?: CareCategory;
  /** Rate printed on the document, if present. */
  rateOverride?: number;
}

export interface Situation {
  /** Date of care — selects which tariffs apply. */
  date: string;
  /** Whether the parcours de soins was followed. */
  coordinatedPathway: boolean;
  /** 100% of base: ALD on related acts, CSS, pregnancy from month 6. */
  fullCoverage?: boolean;
  /**
   * Exemption from the participation forfaitaire and franchises.
   *
   * Not the same as fullCoverage: ALD reimburses 100% of the base but the €2
   * participation is still charged. Only minors, CSS/AME holders and pregnancy
   * from month 6 are exempt.
   */
  exemptFromParticipation?: boolean;
  /** Already paid by the insurer this year — eats into the annual cap. */
  consumedThisYear?: Partial<Record<CareCategory, number>>;
}

/** One step of the calculation, shown to the user. */
export interface Step {
  key:
    | 'base'
    | 'securiteSociale'
    | 'participation'
    | 'franchise'
    | 'mutuelle'
    | 'ceiling'
    | 'overrun';
  /** Positive adds to reimbursement, negative to what you pay. */
  amount: number;
  source?: string;
  /** Raw values; the UI resolves i18n keys. */
  detail?: Record<string, string | number>;
}

export interface LineResult {
  label: string;
  category: CareCategory;
  /** Amount the insurer withheld because the annual cap was reached. */
  cappedByCeiling: number;
  charged: number;
  base: number;
  /**
   * Whether the base is known.
   *
   * false means "cannot be computed", not "reimbursement is zero" — otherwise
   * a line without a base looks like an honest full-cost line and the total
   * lies. A base of zero is still known: out-of-nomenclature acts print it.
   */
  baseKnown: boolean;
  securiteSociale: number;
  /** Participation forfaitaire — never covered by a responsible contract. */
  participation: number;
  /** Medical franchise on pharmacy items. */
  franchise: number;
  mutuelle: number;
  /** Amount charged above the reimbursement base. */
  overrun: number;
  restACharge: number;
  steps: Step[];
}

export interface QuoteResult {
  charged: number;
  securiteSociale: number;
  mutuelle: number;
  restACharge: number;
  lines: LineResult[];
  /**
   * Lines that could not be computed. Above zero the total is incomplete and
   * the UI must say so next to the headline figure.
   */
  unknownLines: number;
}

/**
 * Per-quote accumulator: annual caps and daily limits are consumed line by
 * line. Without it, two crowns in one quote each see an untouched €400 cap.
 */
export interface RunningTotals {
  /** Insurer payouts: this year plus earlier lines of the same quote. */
  consumed: Partial<Record<CareCategory, number>>;
  /** Participation already charged within this quote. */
  participation: number;
  /** Franchise already charged within this quote. */
  franchise: number;
}

/** Round to cents to avoid float drift. */
const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Compute one quote line, following the order Sécu applies:
 * base, rate, participation, insurer top-up, remainder.
 */
export function computeLine(
  line: LineInput,
  contract: MutuelleContract | null,
  situation: Situation,
  /** Consumed by earlier lines of the same quote. */
  running?: RunningTotals,
): LineResult {
  const qty = Math.max(1, Math.round(line.quantity ?? 1));
  const { act, sector } = line;
  const category = line.category ?? act?.category ?? 'other';
  const charged = cents(line.charged * qty);
  const steps: Step[] = [];

  // 1. Reimbursement base. The devis wins over the catalogue; secteur 2
  // without OPTAM is reimbursed from a reduced base.
  let base: number;
  let baseSource: string | undefined;
  let baseKnown: boolean;
  if (line.baseOverride !== undefined) {
    base = cents(line.baseOverride * qty);
    baseSource = 'devis';
    baseKnown = true;
  } else if (act) {
    const reduced = sector === 'secteur2' && act.baseNonOptam;
    const entry = reduced ? valueOn(act.baseNonOptam!, situation.date) : valueOn(act.base, situation.date);
    base = cents((entry?.value ?? 0) * qty);
    baseSource = entry?.source;
    // Act exists but no tariff was in force on that date.
    baseKnown = entry !== null;
  } else {
    base = 0;
    baseKnown = false;
  }
  steps.push({ key: 'base', amount: base, source: baseSource });

  // 2. Sécurité Sociale rate.
  let rate: number;
  let rateSource: string | undefined;
  if (situation.fullCoverage) {
    rate = 1;
    rateSource = 'ALD / CSS / maternité — 100 %';
  } else if (!situation.coordinatedPathway) {
    const outside = valueOn(RATE_OUTSIDE_PATHWAY, situation.date);
    rate = outside?.value ?? 0.3;
    rateSource = outside?.source;
  } else if (line.rateOverride !== undefined) {
    rate = line.rateOverride;
    rateSource = 'devis';
  } else if (act) {
    const r = valueOn(act.rate, situation.date);
    rate = r?.value ?? 0;
    rateSource = r?.source;
  } else {
    rate = 0;
  }

  // Sécu pays on the base, not the charged price.
  const ssGross = cents(Math.min(base, charged) * rate);

  // 3. Participation forfaitaire. The €8 daily cap applies per quote,
  // treating one quote as one day.
  const partEntry = valueOn(PARTICIPATION_FORFAITAIRE, situation.date);
  const chargeable =
    category === 'consultation' || category === 'specialist' || category === 'radiology';
  const partRaw =
    chargeable && !situation.exemptFromParticipation ? cents((partEntry?.value ?? 0) * qty) : 0;
  const partCap = valueOn(PARTICIPATION_DAILY_CAP, situation.date)?.value ?? Infinity;
  const partLeft = cents(Math.max(0, partCap - (running?.participation ?? 0)));
  const participation = cents(Math.min(partRaw, partLeft));

  // Pharmacy franchise: also uncovered, also daily-capped (€4).
  const franchiseEntry = valueOn(FRANCHISE_MEDICAMENT, situation.date);
  const franchiseRaw =
    category === 'pharmacy' && !situation.exemptFromParticipation
      ? cents((franchiseEntry?.value ?? 0) * qty)
      : 0;
  const franchiseCap = valueOn(FRANCHISE_DAILY_CAP, situation.date)?.value ?? Infinity;
  const franchiseLeft = cents(Math.max(0, franchiseCap - (running?.franchise ?? 0)));
  const franchise = cents(Math.min(franchiseRaw, franchiseLeft));

  const securiteSociale = cents(Math.max(0, ssGross - participation - franchise));
  steps.push({ key: 'securiteSociale', amount: securiteSociale, source: rateSource, detail: { rate } });
  if (participation > 0) {
    steps.push({
      key: 'participation',
      amount: -participation,
      source: partEntry?.source,
      ...(participation < partRaw ? { detail: { dailyCap: partCap } } : {}),
    });
  }
  if (franchise > 0) {
    steps.push({
      key: 'franchise',
      amount: -franchise,
      source: franchiseEntry?.source,
      ...(franchise < franchiseRaw ? { detail: { dailyCap: franchiseCap } } : {}),
    });
  }

  // 4. Insurer. "200% BR" includes the Sécu share, it does not stack on top.
  let mutuelle = 0;
  const cover = contract?.coverage[category] ?? { kind: 'none' as const };
  if (cover.kind === 'percentOfBase') {
    const ceiling = cents(base * (cover.percent / 100));
    mutuelle = cents(Math.max(0, Math.min(ceiling, charged) - ssGross));
  } else if (cover.kind === 'flatEuro') {
    const ceiling = cents(cover.amount * qty);
    mutuelle = cents(Math.max(0, Math.min(ceiling, cents(charged - ssGross))));
  }
  // Reimbursement cannot exceed what was actually charged.
  mutuelle = cents(Math.max(0, Math.min(mutuelle, charged - securiteSociale)));

  // Annual cap, applied after the normal calculation.
  const ceiling = contract?.annualCeiling?.[category];
  const consumedBefore = running?.consumed ?? situation.consumedThisYear;
  let cappedBy = 0;
  if (ceiling !== undefined) {
    const used = consumedBefore?.[category] ?? 0;
    const remaining = cents(Math.max(0, ceiling - used));
    if (mutuelle > remaining) {
      cappedBy = cents(mutuelle - remaining);
      mutuelle = remaining;
    }
  }

  if (mutuelle > 0) steps.push({ key: 'mutuelle', amount: mutuelle });
  if (cappedBy > 0) {
    steps.push({
      key: 'ceiling',
      amount: -cappedBy,
      detail: { ceiling: ceiling ?? 0, used: consumedBefore?.[category] ?? 0 },
    });
  }

  // 5. Amount above the base.
  const overrun = cents(Math.max(0, charged - base));
  if (overrun > 0) steps.push({ key: 'overrun', amount: -overrun });

  const restACharge = cents(Math.max(0, charged - securiteSociale - mutuelle));

  return {
    label: line.labelOverride ?? act?.label.fr ?? '—',
    category,
    cappedByCeiling: cappedBy,
    charged,
    base,
    baseKnown,
    securiteSociale,
    participation,
    franchise,
    mutuelle,
    overrun,
    restACharge,
    steps,
  };
}

/**
 * Whole quote. Lines are computed in sequence, not independently: the annual
 * cap and daily limits are a shared resource across the quote.
 */
export function computeQuote(
  lines: LineInput[],
  contract: MutuelleContract | null,
  situation: Situation,
): QuoteResult {
  let running: RunningTotals = {
    consumed: { ...(situation.consumedThisYear ?? {}) },
    participation: 0,
    franchise: 0,
  };

  const results: LineResult[] = [];
  for (const line of lines) {
    const r = computeLine(line, contract, situation, running);
    results.push(r);
    running = {
      consumed: {
        ...running.consumed,
        [r.category]: cents((running.consumed[r.category] ?? 0) + r.mutuelle),
      },
      participation: cents(running.participation + r.participation),
      franchise: cents(running.franchise + r.franchise),
    };
  }

  const sum = (pick: (r: LineResult) => number) => cents(results.reduce((a, r) => a + pick(r), 0));

  return {
    charged: sum((r) => r.charged),
    securiteSociale: sum((r) => r.securiteSociale),
    mutuelle: sum((r) => r.mutuelle),
    restACharge: sum((r) => r.restACharge),
    lines: results,
    unknownLines: results.filter((r) => !r.baseKnown).length,
  };
}
