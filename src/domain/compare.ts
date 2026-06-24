import { LineInput, MutuelleContract, QuoteResult, Situation, computeQuote } from './reimbursement';
import { CareCategory } from './tariffs';

/**
 * Compare options before signing a devis.
 *
 * Deliberately no "regional average prices": open data of that precision does
 * not exist, and an invented figure about money is worse than none. Only what
 * can be computed honestly — your devis against the 100% Santé basket and
 * against an arbitrary price.
 *
 * The 100% Santé basket is law, not marketing: since 2020 a dentist must offer
 * a zero-out-of-pocket option on the quote where technically possible.
 */

export interface Scenario {
  key: 'quote' | 'zeroRac' | 'custom';
  label: string;
  result: QuoteResult;
  /** Difference against the baseline; negative means cheaper. */
  deltaVsQuote: number;
}

/** Categories where a zero-out-of-pocket basket exists by law. */
const ZERO_RAC_CATEGORIES: CareCategory[] = ['dental', 'optical'];

export const hasZeroRacOption = (categories: CareCategory[]) =>
  categories.some((c) => ZERO_RAC_CATEGORIES.includes(c));

/**
 * Everything eligible taken from the 100% Santé basket.
 *
 * The price is capped by law, Sécu pays its share and a responsible contract
 * covers the rest. Modelled by setting the price equal to the base: no
 * overrun, so the remainder collapses to the flat deductions.
 */
function toZeroRac(lines: LineInput[]): LineInput[] {
  return lines.map((line) => {
    const category = line.category ?? line.act?.category ?? 'other';
    if (!ZERO_RAC_CATEGORIES.includes(category)) return line;

    const base = line.baseOverride ?? 0;
    // Without a known base the option cannot be modelled.
    if (base <= 0) return line;

    return { ...line, charged: base };
  });
}

export function compareScenarios(
  lines: LineInput[],
  contract: MutuelleContract | null,
  situation: Situation,
  customPrices?: number[],
): Scenario[] {
  const quote = computeQuote(lines, contract, situation);
  const out: Scenario[] = [
    { key: 'quote', label: 'quote', result: quote, deltaVsQuote: 0 },
  ];

  const categories = lines.map((l) => l.category ?? l.act?.category ?? 'other');
  if (hasZeroRacOption(categories)) {
    const zero = computeQuote(toZeroRac(lines), contract, situation);
    out.push({
      key: 'zeroRac',
      label: 'zeroRac',
      result: zero,
      deltaVsQuote: round(zero.restACharge - quote.restACharge),
    });
  }

  if (customPrices?.length === lines.length) {
    const custom = computeQuote(
      lines.map((l, i) => ({ ...l, charged: customPrices[i] })),
      contract,
      situation,
    );
    out.push({
      key: 'custom',
      label: 'custom',
      result: custom,
      deltaVsQuote: round(custom.restACharge - quote.restACharge),
    });
  }

  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;
