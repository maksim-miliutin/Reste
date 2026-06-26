import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MatchStatus } from '@/domain/matching';
import { ceilingYearStart } from '@/domain/ceilings';
import type { MutuelleContract } from '@/domain/reimbursement';
import type { CareCategory, Sector } from '@/domain/tariffs';
import type { Lang } from '@/i18n';

/**
 * A quote line after parsing. Keeps both what the document printed and the
 * verdict of matching it against the catalogue, so the user can see where the
 * reimbursement base came from.
 */
export interface QuoteLine {
  id: string;
  actCode: string;
  label: string;
  charged: number;
  base?: number;
  category?: CareCategory;
  quantity: number;
  status: MatchStatus;
  referenceBase?: number;
}

/** An insurer payout already made — consumes the annual cap. */
export interface LedgerEntry {
  id: string;
  /** Payout date, YYYY-MM-DD. A date, not a year: some contracts start the
   *  cap period on a day other than 1 January. */
  date: string;
  category: CareCategory;
  amount: number;
  label: string;
}

interface AppState {
  lang: Lang | null;
  contract: MutuelleContract | null;
  sector: Sector;
  coordinatedPathway: boolean;
  fullCoverage: boolean;
  /**
   * Exemption from the participation forfaitaire — separate from
   * fullCoverage. ALD reimburses 100% but the €2 is still charged; only CSS,
   * AME, minors and pregnancy from month 6 are exempt.
   */
  exemption: boolean;
  lines: QuoteLine[];
  ledger: LedgerEntry[];

  setLang: (l: Lang) => void;
  setContract: (c: MutuelleContract | null) => void;
  /** Annual cap entered by hand: parsing often misses it in a footnote. */
  setCeiling: (category: CareCategory, amount: number | undefined) => void;
  setSector: (s: Sector) => void;
  setPathway: (v: boolean) => void;
  setFullCoverage: (v: boolean) => void;
  setExemption: (v: boolean) => void;
  replaceLines: (ls: Omit<QuoteLine, 'id'>[]) => void;
  updateLine: (id: string, patch: Partial<Omit<QuoteLine, 'id'>>) => void;
  removeLine: (id: string) => void;
  clearLines: () => void;

  addToLedger: (e: Omit<LedgerEntry, 'id' | 'date'> & { date?: string }) => void;
  removeFromLedger: (id: string) => void;
  /** Insurer payouts this year, per category. */
  consumedThisYear: () => Partial<Record<CareCategory, number>>;
}

const withId = (l: Omit<QuoteLine, 'id'>): QuoteLine => ({
  ...l,
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
});

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      lang: null,
      contract: null,
      sector: 'secteur1',
      coordinatedPathway: true,
      fullCoverage: false,
      exemption: false,
      lines: [],
      ledger: [],

      setLang: (lang) => set({ lang }),
      setContract: (contract) => set({ contract }),
      setCeiling: (category, amount) => {
        // The cap can be set before cover is filled in — it comes from a
        // contract footnote, not the guarantees table.
        const base = get().contract ?? { name: '', responsible: true, coverage: {} };
        const next = { ...(base.annualCeiling ?? {}) };
        if (amount === undefined || amount <= 0) delete next[category];
        else next[category] = Math.round(amount * 100) / 100;
        set({
          contract: {
            ...base,
            annualCeiling: Object.keys(next).length > 0 ? next : undefined,
          },
        });
      },
      setSector: (sector) => set({ sector }),
      setPathway: (coordinatedPathway) => set({ coordinatedPathway }),
      setFullCoverage: (fullCoverage) => set({ fullCoverage }),
      setExemption: (exemption) => set({ exemption }),

      replaceLines: (ls) => set({ lines: ls.map(withId) }),
      updateLine: (id, patch) =>
        set({ lines: get().lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }),
      removeLine: (id) => set({ lines: get().lines.filter((x) => x.id !== id) }),
      clearLines: () => set({ lines: [] }),

      addToLedger: (e) =>
        set({
          ledger: [
            {
              ...e,
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              date: e.date ?? new Date().toISOString().slice(0, 10),
            },
            ...get().ledger,
          ].slice(0, 200),
        }),
      removeFromLedger: (id) => set({ ledger: get().ledger.filter((e) => e.id !== id) }),

      consumedThisYear: () => {
        // Window starts at this contract's cap year, not 1 January.
        const from = ceilingYearStart(get().contract);
        const out: Partial<Record<CareCategory, number>> = {};
        for (const e of get().ledger) {
          if (e.date < from) continue;
          out[e.category] = Math.round(((out[e.category] ?? 0) + e.amount) * 100) / 100;
        }
        return out;
      },
    }),
    { name: 'reste-store', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
