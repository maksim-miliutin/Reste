/**
 * Sécurité Sociale tariff catalogue.
 *
 * Rates are dated data, not constants. The GP consultation went from €26.50 to
 * €30 in December 2024 and the participation forfaitaire from €1 to €2 in May
 * 2024. Hardcoded figures go stale silently, so every rate carries a validity
 * period and a source, and every calculation is made as of a date.
 *
 * Reference values for estimation. Only ameli.fr and your own contract are
 * authoritative.
 */

/** Doctor sector — determines whether they may charge above the tariff. */
export type Sector = 'secteur1' | 'secteur2_optam' | 'secteur2';

/** Care category — insurers define cover per category. */
export type CareCategory =
  | 'consultation'
  | 'specialist'
  | 'dental'
  | 'optical'
  | 'hospital'
  | 'lab'
  | 'radiology'
  | 'pharmacy'
  | 'other';

/** A rate with a validity period. `to = null` means currently in force. */
export interface Dated<T> {
  from: string; // YYYY-MM-DD
  to: string | null;
  value: T;
  /** Shown to the user next to the figure. */
  source: string;
}

/** A medical act: code, reimbursement base, Sécu rate. */
export interface ActTariff {
  /** NGAP code for consultations, CCAM for procedures. */
  code: string;
  category: CareCategory;
  label: { fr: string; en: string; ru: string };
  /** Reimbursement base (BRSS) in euros, by period. */
  base: Dated<number>[];
  /** Sécu reimbursement rate as a share of the base. */
  rate: Dated<number>[];
  /**
   * Reduced base for non-OPTAM doctors: a secteur 2 GP is reimbursed from
   * €23 rather than €30.
   */
  baseNonOptam?: Dated<number>[];
}

const AMELI = 'ameli.fr — tarifs conventionnels';

/**
 * Flat deductions withheld by Sécu. Responsible contracts may not cover them,
 * so they always stay in the out-of-pocket total.
 */
export const PARTICIPATION_FORFAITAIRE: Dated<number>[] = [
  { from: '2005-01-01', to: '2024-05-14', value: 1, source: AMELI },
  { from: '2024-05-15', to: null, value: 2, source: `${AMELI} — participation forfaitaire` },
];

/**
 * Daily cap on the participation forfaitaire.
 *
 * One quote is treated as one day, so the cap applies across the whole quote:
 * five consultations in a day cost €8, not €10.
 *
 * The €50 annual cap is not modelled — that would require knowing what the
 * user already paid this year, and the ledger stores insurer payouts, not Sécu
 * deductions. The result can therefore overstate the cost slightly, never
 * understate it.
 */
export const PARTICIPATION_DAILY_CAP: Dated<number>[] = [
  { from: '2005-01-01', to: null, value: 8, source: `${AMELI} — plafond journalier` },
];

/** Pharmacy franchise, per package. */
export const FRANCHISE_MEDICAMENT: Dated<number>[] = [
  { from: '2008-01-01', to: '2024-03-30', value: 0.5, source: AMELI },
  { from: '2024-03-31', to: null, value: 1, source: `${AMELI} — franchise médicale` },
];

/** Daily cap on the pharmacy franchise. No annual cap, see above. */
export const FRANCHISE_DAILY_CAP: Dated<number>[] = [
  { from: '2008-01-01', to: null, value: 4, source: `${AMELI} — plafond journalier` },
];

/** Rate outside the parcours de soins coordonnés. */
export const RATE_OUTSIDE_PATHWAY: Dated<number>[] = [
  { from: '2005-01-01', to: null, value: 0.3, source: `${AMELI} — parcours de soins` },
];

/**
 * Act tariffs. Deliberately short and covering common cases — the full CCAM
 * has thousands of codes and belongs in a fetched dataset, not the bundle.
 */
export const ACTS: ActTariff[] = [
  {
    code: 'G / GS',
    category: 'consultation',
    label: {
      fr: 'Consultation généraliste',
      en: 'GP consultation',
      ru: 'Приём терапевта',
    },
    base: [
      { from: '2023-11-01', to: '2024-12-21', value: 26.5, source: AMELI },
      { from: '2024-12-22', to: null, value: 30, source: `${AMELI} — convention 2024-2029` },
    ],
    rate: [{ from: '2005-01-01', to: null, value: 0.7, source: AMELI }],
    baseNonOptam: [{ from: '2024-12-22', to: null, value: 23, source: `${AMELI} — hors OPTAM` }],
  },
  {
    code: 'G-6ans',
    category: 'consultation',
    label: {
      fr: 'Consultation généraliste, enfant de moins de 6 ans',
      en: 'GP consultation, child under 6',
      ru: 'Приём терапевта, ребёнок до 6 лет',
    },
    base: [{ from: '2024-12-22', to: null, value: 35, source: AMELI }],
    rate: [{ from: '2005-01-01', to: null, value: 0.7, source: AMELI }],
  },
  {
    code: 'CS',
    category: 'specialist',
    label: {
      fr: 'Consultation spécialiste',
      en: 'Specialist consultation',
      ru: 'Приём специалиста',
    },
    base: [{ from: '2024-12-22', to: null, value: 31.5, source: AMELI }],
    rate: [{ from: '2005-01-01', to: null, value: 0.7, source: AMELI }],
    baseNonOptam: [{ from: '2024-12-22', to: null, value: 23, source: `${AMELI} — hors OPTAM` }],
  },
  {
    code: 'C-dentiste',
    category: 'dental',
    label: {
      fr: 'Consultation dentaire',
      en: 'Dental consultation',
      ru: 'Приём стоматолога',
    },
    base: [{ from: '2023-01-01', to: null, value: 23, source: AMELI }],
    rate: [{ from: '2005-01-01', to: null, value: 0.7, source: AMELI }],
  },
  {
    code: 'HBLD038',
    category: 'dental',
    label: {
      fr: 'Couronne céramo-métallique',
      en: 'Ceramic-metal crown',
      ru: 'Металлокерамическая коронка',
    },
    // 100% Santé capped tariff: the base sits below the real price.
    base: [{ from: '2021-01-01', to: null, value: 120, source: `${AMELI} — CCAM, panier 100 % Santé` }],
    rate: [{ from: '2005-01-01', to: null, value: 0.7, source: AMELI }],
  },
  {
    code: 'HBFD001',
    category: 'dental',
    label: {
      fr: 'Détartrage',
      en: 'Scaling',
      ru: 'Профессиональная чистка',
    },
    base: [{ from: '2021-01-01', to: null, value: 28.92, source: `${AMELI} — CCAM` }],
    rate: [{ from: '2005-01-01', to: null, value: 0.7, source: AMELI }],
  },
  {
    code: 'AMK/AMC',
    category: 'other',
    label: {
      fr: 'Séance de kinésithérapie',
      en: 'Physiotherapy session',
      ru: 'Сеанс физиотерапии',
    },
    base: [{ from: '2023-01-01', to: null, value: 16.13, source: AMELI }],
    rate: [{ from: '2005-01-01', to: null, value: 0.6, source: AMELI }],
  },
  {
    code: 'OPT-monture',
    category: 'optical',
    label: {
      fr: 'Monture de lunettes',
      en: 'Spectacle frame',
      ru: 'Оправа для очков',
    },
    // Token base: in practice the insurer or 100% Santé pays.
    base: [{ from: '2020-01-01', to: null, value: 0.05, source: `${AMELI} — LPP optique` }],
    rate: [{ from: '2005-01-01', to: null, value: 0.6, source: AMELI }],
  },
];

/** Value in force on a date. Dates compare as strings — the format sorts. */
export function valueOn<T>(series: Dated<T>[], date: string): Dated<T> | null {
  for (const d of series) {
    if (date >= d.from && (d.to === null || date <= d.to)) return d;
  }
  return null;
}

export const findAct = (code: string): ActTariff | undefined =>
  ACTS.find((a) => a.code === code);
