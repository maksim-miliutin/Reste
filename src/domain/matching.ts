import { LineInput } from './reimbursement';
import { ACTS, ActTariff, CareCategory, Sector, valueOn } from './tariffs';

/** A line as returned by document parsing. */
export interface ExtractedLine {
  code?: string;
  label: string;
  charged: number;
  /** "Base de remboursement SS" — dental and optical must print it. */
  base?: number;
  quantity?: number;
  category?: CareCategory;
}

export type MatchStatus =
  /** Code found and the document base matches the catalogue. */
  | 'confirmed'
  /** Code found but the base differs — both figures are shown. */
  | 'mismatch'
  /** Code unknown; computed from the document base. */
  | 'documentOnly'
  /** Neither code nor base — cannot be computed. */
  | 'unknown';

export interface MatchedLine {
  status: MatchStatus;
  input: LineInput;
  /** Catalogue base, shown alongside when it differs. */
  referenceBase?: number;
  extracted: ExtractedLine;
}

/** A one-cent difference is rounding, not an error. */
const SAME = 0.01;

function lookup(code?: string): ActTariff | undefined {
  if (!code) return undefined;
  const norm = code.trim().toUpperCase();
  return ACTS.find((a) => a.code.toUpperCase() === norm);
}

/**
 * Match a parsed devis against the catalogue.
 *
 * The document wins: what is printed is what the insurer will use. The
 * catalogue catches an understated base and surfaces both figures.
 */
export function matchLine(extracted: ExtractedLine, sector: Sector, date: string): MatchedLine {
  const act = lookup(extracted.code);
  const category = extracted.category ?? act?.category ?? 'other';
  const quantity = Math.max(1, Math.round(extracted.quantity ?? 1));

  const refEntry = act ? valueOn(act.base, date) : null;
  const referenceBase = refEntry?.value;

  const base = { input: extracted.base, reference: referenceBase };

  let status: MatchStatus;
  if (base.input !== undefined && base.reference !== undefined) {
    status = Math.abs(base.input - base.reference) <= SAME ? 'confirmed' : 'mismatch';
  } else if (base.input !== undefined) {
    status = 'documentOnly';
  } else if (base.reference !== undefined) {
    status = 'confirmed';
  } else {
    status = 'unknown';
  }

  return {
    status,
    referenceBase,
    extracted,
    input: {
      act,
      charged: extracted.charged,
      sector,
      quantity,
      category,
      labelOverride: act ? undefined : extracted.label,
      baseOverride: base.input,
    },
  };
}

export const matchQuote = (lines: ExtractedLine[], sector: Sector, date: string) =>
  lines.map((l) => matchLine(l, sector, date));
