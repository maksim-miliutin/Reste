import { useMemo } from 'react';
import type { LineInput, Situation } from '@/domain/reimbursement';
import { findAct } from '@/domain/tariffs';
import { useAppStore } from './useAppStore';

/**
 * Single place where stored lines become engine input.
 *
 * This conversion used to be duplicated in index.tsx and compare.tsx, so two
 * screens could disagree about the same quote. In a product about money that
 * is the worst kind of drift: both numbers look convincing, one is right.
 */
export function useQuoteInputs(): LineInput[] {
  const lines = useAppStore((s) => s.lines);
  const sector = useAppStore((s) => s.sector);

  return useMemo(
    () =>
      lines.map((l) => {
        const act = findAct(l.actCode);
        return {
          act,
          charged: l.charged,
          sector,
          quantity: l.quantity,
          baseOverride: l.base,
          labelOverride: act ? undefined : l.label,
          category: l.category,
        };
      }),
    [lines, sector],
  );
}

/**
 * Calculation context.
 *
 * fullCoverage and exemption are deliberately separate: ALD reimburses 100%
 * but the participation forfaitaire is still charged.
 */
export function useSituation(date = new Date().toISOString().slice(0, 10)): Situation {
  const coordinatedPathway = useAppStore((s) => s.coordinatedPathway);
  const fullCoverage = useAppStore((s) => s.fullCoverage);
  const exemption = useAppStore((s) => s.exemption);
  const contract = useAppStore((s) => s.contract);
  const ledger = useAppStore((s) => s.ledger);
  const consumedThisYear = useAppStore((s) => s.consumedThisYear);

  // Subscribe to ledger and contract for a stable reference:
  // consumedThisYear() returns a fresh object on every call.
  const consumed = useMemo(
    () => consumedThisYear(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ledger, contract, consumedThisYear],
  );

  return useMemo(
    () => ({
      date,
      coordinatedPathway,
      fullCoverage,
      exemptFromParticipation: exemption,
      consumedThisYear: consumed,
    }),
    [date, coordinatedPathway, fullCoverage, exemption, consumed],
  );
}
