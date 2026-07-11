import * as ImageManipulator from 'expo-image-manipulator';
import { ExtractedLine } from '@/domain/matching';
import { Coverage, MutuelleContract } from '@/domain/reimbursement';
import { CareCategory } from '@/domain/tariffs';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const MOCK = process.env.EXPO_PUBLIC_MOCK_AI === '1' || !API;

export interface ParsedQuote {
  provider?: string;
  date?: string;
  lines: ExtractedLine[];
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'network' | 'unreadable' | 'quota' };

/**
 * Resize to 1600px: the small print on a quote has to stay readable.
 *
 * SDK 52 introduced a new expo-image-manipulator API (manipulate → renderAsync
 * → saveAsync) and deprecated manipulateAsync. Which one is alive in a given
 * version only shows at runtime, so try the new one and fall back.
 */
async function prepare(uri: string): Promise<string> {
  const M = ImageManipulator as unknown as {
    manipulate?: (uri: string) => { resize: (o: { width: number }) => { renderAsync: () => Promise<{ saveAsync: (o: object) => Promise<{ base64?: string }> }> } };
    manipulateAsync?: (uri: string, actions: object[], opts: object) => Promise<{ base64?: string }>;
    SaveFormat: { JPEG: string };
  };
  const options = { compress: 0.8, format: M.SaveFormat.JPEG, base64: true };

  if (typeof M.manipulate === 'function') {
    const image = await M.manipulate(uri).resize({ width: 1600 }).renderAsync();
    const out = await image.saveAsync(options);
    return out.base64 ?? '';
  }

  const out = await M.manipulateAsync!(uri, [{ resize: { width: 1600 } }], options);
  return out.base64 ?? '';
}

async function post<T>(path: string, body: unknown): Promise<ParseResult<T>> {
  try {
    const res = await fetch(`${API}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) return { ok: false, reason: 'quota' };
    if (!res.ok) return { ok: false, reason: 'network' };
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** A real dental devis: price, reimbursement base, CCAM codes. */
const MOCK_QUOTE: ParsedQuote = {
  provider: 'Cabinet dentaire (exemple)',
  date: '2026-07-01',
  lines: [
    { code: 'HBLD038', label: 'Couronne céramo-métallique 26', charged: 800, base: 120, quantity: 1, category: 'dental' },
    { code: 'HBFD001', label: 'Détartrage', charged: 43, base: 28.92, quantity: 1, category: 'dental' },
    { code: 'C-dentiste', label: 'Consultation', charged: 23, base: 23, quantity: 1, category: 'dental' },
  ],
};

const MOCK_CONTRACT: MutuelleContract = {
  name: 'Contrat exemple — Confort',
  responsible: true,
  coverage: {
    consultation: { kind: 'percentOfBase', percent: 150 },
    specialist: { kind: 'percentOfBase', percent: 150 },
    dental: { kind: 'percentOfBase', percent: 300 },
    optical: { kind: 'flatEuro', amount: 200 },
    hospital: { kind: 'percentOfBase', percent: 200 },
    lab: { kind: 'percentOfBase', percent: 100 },
    radiology: { kind: 'percentOfBase', percent: 100 },
    pharmacy: { kind: 'percentOfBase', percent: 100 },
  },
  // Common trap: a generous percentage next to a modest annual cap.
  annualCeiling: { dental: 400, optical: 200 },
  // Non-calendar years are common: the period starts at signature.
  ceilingYearStart: '07-01',
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function parseQuote(uri: string): Promise<ParseResult<ParsedQuote>> {
  if (MOCK) {
    await delay(1200);
    return { ok: true, data: MOCK_QUOTE };
  }
  const base64 = await prepare(uri);
  if (!base64) return { ok: false, reason: 'unreadable' };
  return post<ParsedQuote>('parse-devis', { image: base64 });
}

export async function parseContract(uri: string): Promise<ParseResult<MutuelleContract>> {
  if (MOCK) {
    await delay(1200);
    return { ok: true, data: MOCK_CONTRACT };
  }
  const base64 = await prepare(uri);
  if (!base64) return { ok: false, reason: 'unreadable' };
  return post<MutuelleContract>('parse-contract', { image: base64 });
}

/** Human-readable cover: "300% BR" or "€200". */
export function describeCoverage(c: Coverage | undefined): string {
  if (!c || c.kind === 'none') return '—';
  return c.kind === 'percentOfBase' ? `${c.percent} % BR` : `${c.amount} €`;
}

/**
 * Categories exposed in the UI.
 *
 * 'other' is required: physiotherapy (AMK/AMC) falls into it, and while it was
 * missing the cover could not be set at all — the engine silently treated it
 * as uncovered.
 */
export const CATEGORIES: CareCategory[] = [
  'consultation',
  'specialist',
  'dental',
  'optical',
  'hospital',
  'lab',
  'radiology',
  'pharmacy',
  'other',
];
