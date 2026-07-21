# Reste — technical notes

The app computes **reste à charge** — what a person actually pays out of pocket
for medical care in France. It scans a devis, scans the insurer's guarantee
table, and shows the breakdown with a source for every figure.

---

## 1. The problem

French cover is quoted as a percentage of a *reimbursement base*, not of the
price. "Reimbursed at 70%" sounds like 70% of the bill; it is 70% of a base
that can be a fifth of what you pay.

A crown costs **€800**. The base is **€120**. Sécu returns **€84**, not €560.
The insurer tops up from the same base, not from the price. Nobody spells this
out before you sign.

| | |
|---|---|
| Stack | Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript strict |
| Routing | expo-router |
| State | Zustand + AsyncStorage |
| Backend | Supabase Edge Functions (Deno) proxying the Anthropic API |
| Locales | fr (primary), en, ru — 83 keys, parity enforced at type level |
| Tests | 67 cases on domain logic |

---

## 2. Key decision: tariffs are data, not constants

Rates are stored **with an effective date and a source**, and every calculation
is made as of a date.

The reason is concrete: the GP consultation went from €26.50 to €30 on
22 December 2024; the participation forfaitaire from €1 to €2 on 15 May 2024;
the 100% Santé caps are reindexed annually. Hardcoded figures go stale within
months and **silently** return wrong answers — and a wrong answer about money
is the main risk this product carries.

```ts
export const PARTICIPATION_FORFAITAIRE: Dated<number>[] = [
  { from: '2005-01-01', to: '2024-05-14', value: 1, source: AMELI },
  { from: '2024-05-15', to: null,         value: 2, source: AMELI },
];
```

---

## 3. Second decision: the document beats the catalogue

Dental and optical quotes are **required by law** to print a
"base de remboursement SS" line. That figure is more accurate than any bundled
catalogue, because it is the one the insurer will actually use.

So the full CCAM catalogue (thousands of codes) is unnecessary:

- the base is read **straight off the devis**;
- the built-in catalogue serves as a **cross-check**;
- on a mismatch **both figures are shown** rather than one silently chosen.

This also solves unknown codes: an act missing from the catalogue is computed
from the document base. With neither code nor base, the app says
"reimbursement unknown" instead of inventing a number.

---

## 4. Layout

```
app/
  index.tsx      result: out-of-pocket in large type + step breakdown
  scan.tsx       camera for the devis (A4 guide frame)
  contract.tsx   insurer: scan the guarantee table or enter by hand
  review.tsx     check the parsed lines before computing — every field editable
  ledger.tsx     insurer payouts to date + remaining annual caps
  compare.tsx    comparison against the 100% Santé basket
  settings.tsx   doctor sector, care pathway, ALD, exemption, language
  _layout.tsx    font loading, splash held until ready

src/domain/          all logic, pure functions, no react-native
  tariffs.ts         catalogue with dates and sources
  reimbursement.ts   calculation engine
  matching.ts        parsed devis vs catalogue
  compare.ts         pre-signature scenarios
  ceilings.ts        annual caps and their expiry
  __tests__/         67 cases

src/store/
  useAppStore.ts     state, persistence, payout ledger
  useQuote.ts        the ONE place where stored lines become engine input.
                     This used to be duplicated in index.tsx and compare.tsx,
                     so two screens could disagree about the same quote

src/services/ai.ts   document parsing client + mock mode
scripts/
  check-dead-code.js logic unreachable from the UI
  check-i18n.js      every key a screen asks for exists in all dictionaries
backend/supabase/functions/
  parse-devis/       quote photo → lines
  parse-contract/    guarantee table photo → cover and caps
  _shared/           Anthropic layer, the key lives only here
                     (excluded from tsconfig: it is Deno, checked by deno check)
```

---
