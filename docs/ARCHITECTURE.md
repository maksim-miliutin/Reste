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

## 5. Calculation order

Mirrors the order Sécu applies:

1. **Reimbursement base** — from the document, otherwise the catalogue. For
   secteur 2 without OPTAM the base is reduced (€23 instead of €30).
2. **Rate** — 70% normally, 30% outside the care pathway, 100% under ALD/CSS.
   Applied to the base, not the price — the main source of confusion.
3. **Participation forfaitaire** (€2) is deducted. Responsible contracts are
   barred by law from covering it, so it always stays out of pocket.
4. **Insurer** tops up to its ceiling. Note: "300% BR" is a ceiling of 300% of
   the base **including** the Sécu share, not on top of it.
5. **Annual cap** trims the payout once the category limit is exhausted.
6. What remains is the **reste à charge**.

Every step is returned as a separate record with a source, so the result is not
a black box.

**Lines are computed in sequence, not independently.** The annual cap and the
daily deduction limits (€8 on participation, €4 on the franchise) are shared
across the document: the second crown sees a cap already spent by the first.
While lines were computed independently, a two-crown quote promised €552 of
cover where the contract pays €400.

**ALD and exemption from the participation are two different flags.** ALD
reimburses 100% of the base, but the €2 is still charged; only CSS, AME, minors
and pregnancy from month 6 are exempt. While one was inferred from the other,
costs were understated for exactly the people who see a doctor most.

**An unknown base is not a zero base.** `baseKnown: false` means there is
neither a catalogue code nor a document line — it cannot be computed. A base of
zero is perfectly known: out-of-nomenclature acts print it that way. The
difference surfaces as `unknownLines` in the quote result, with a warning next
to the headline figure that the total is incomplete.

---

## 6. Annual caps

The second most common unpleasant surprise after the base. A contract promises
"300% on dental" and adds €400/year in small print — the second crown of the
year is barely covered.

The chain is closed end to end:

- `parse-contract` looks for caps **deliberately**, prompted that they hide in
  footnotes ("dans la limite de 400 € par an");
- the cap and the flat per-act amount can also be entered **by hand** on the
  contract screen: parsing misses the footnote regularly, and without a manual
  field the rest of the chain stayed unreachable;
- `ledger.tsx` — the user records payouts from statements (there is nowhere to
  pull this data from automatically);
- the engine subtracts what was consumed and shows the trim as a **separate
  step**;
- in the last quarter a reminder appears that limits reset on 31 December.

**The tone of that reminder is a deliberate constraint.** These are medical
costs, not a sale. No countdown, no "hurry", no alarming colour: the fact is
stated once, and only if more than €50 remains and less than a quarter is left.
Nudging someone toward unnecessary treatment to "use up the limit" would be
harmful.

---

## 7. Comparison before signing

**The 100% Santé basket** is law, not marketing: since 2020 a dentist must
offer a zero-out-of-pocket option on the quote where technically possible. The
app computes what that option would cost and shows the gap. If the line is
missing from your devis, that is worth asking about.

**Deliberately absent: "average regional prices".** Open data of that precision
does not exist, and an invented figure about money is worse than none. Only
what can be computed honestly is compared: your quote against the statutory
basket and against a price the user enters themselves.

---

## 8. Privacy and boundaries

- The calculation runs entirely **on device**; history never leaves the phone.
- Photos are sent for parsing and **not stored** server-side.
- The Anthropic key lives only in the Edge Function.
- `EXPO_PUBLIC_MOCK_AI=1` — the app works fully without a backend.

**Reste is an information tool, not insurance intermediation.** It does not
sell, compare or recommend insurance products: that is regulated activity
(the ORIAS register). Everywhere "estimate", nowhere "guarantee"; only ameli.fr
and your own contract are authoritative.

---

## 9. Checking for unreachable code

```bash
npm run check:dead
```

A separate script, because the same mistake happened three times during
development: logic written, tests green, and no way to reach it from the UI.
That was the case with the payout ledger, with the situation parameters (doctor
sector, care pathway) and with the cap year start — in every case the field
existed and was covered by tests, but nothing could fill it.

A normal linter does not catch this: formally everything is "used" within its
module. The script looks for domain exports without consumers and store actions
absent from every screen. It runs in CI.

```bash
npm run check:i18n
```

A second check of the same kind, and it exists because of a real failure: the
`compare` block in the dictionaries was left unclosed, and `ledger`, `expiry`,
`settings`, `first` and `review` ended up nested inside it — identically in all
three files. Type parity (`en: typeof fr`) still matched, `tsc --noEmit` stayed
silent, and half the app rendered raw keys like `settings.title`. Types
guarantee the shape of a dictionary, not that the shape is correct. The script
takes every key a screen asks `t()` for, including template families
(`step.${…}`, `category.${…}`), and verifies it resolves in all three
dictionaries.

---

## 10. Development

```bash
npm install
npx expo start          # runs on mocks, no keys needed
npm test                # 67 cases
npm run typecheck       # types + locale parity
npm run lint
```

Both parsing prompts carry one hard rule: **infer nothing**. If the base is not
on the document, the field stays empty. An invented figure costs more than a
gap: someone will make a decision about money based on it.

---

## 11. Decisions that are easy to get wrong

### A human stands between OCR and money

The scanner never leads straight to a result: after parsing, `review.tsx` opens
and shows what was read **and what was not**. Lines without a reimbursement
base are highlighted separately — the model can miss a line or misread a digit,
and without this screen the app would present an incomplete calculation as a
complete one, with the same confidence. Every field is editable.

### The cap year is not always the calendar year

Some contracts count the year from the signature date. The reset point comes
from the contract (`ceilingYearStart`, MM-DD), and the ledger stores **dates**,
not years — otherwise the remaining balance would be wrong by half for those
users.

### Line status is decided by the domain, not the screen

`review.tsx` does not derive status itself: it calls `matchLine`. While the
screen guessed status from a single signal — "the base field is empty" —
editing the label of a line found in the catalogue marked it as uncomputable.
The calculation stayed correct while the UI said "reimbursement unknown". In a
product selling trust in a number, a false warning costs as much as a wrong
number.

---

## 12. Next

- Testing against **real** documents: building further before that is risky.
- Full CCAM catalogue — server-side, not bundled.
- Parsing paper reimbursement statements so the ledger fills itself.
- Annual deduction limits (€50 on participation, €50 on the franchise): the
  daily ones are handled, the annual ones need data the app does not have. As a
  result the calculation can overstate the cost slightly, never understate it —
  an error in the only acceptable direction.
