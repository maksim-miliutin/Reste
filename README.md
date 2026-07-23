<div align="center">

# Reste

**Ce que vous paierez vraiment.**
Scan a French medical quote, see your actual out-of-pocket cost — with every
number traced back to its official source.

![Expo SDK 57](https://img.shields.io/badge/Expo-SDK_57-000?logo=expo&logoColor=fff)
![React Native 0.86](https://img.shields.io/badge/React_Native-0.86-20232a?logo=react)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=fff)
![Tests](https://img.shields.io/badge/tests-67_passing-3F7A55)

</div>

## The problem

French health cover is deliberately opaque. “Reimbursed at 70 %” sounds like
you get 70 % of the bill back. You don’t — it is 70 % of a **reimbursement
base** that can be a fraction of the price.

A ceramic crown costs **€800**. Its base is **€120**. The state returns
**€84**, not €560. Your insurer tops up against that same base, not the price.
Nobody tells you this before you sign the devis.

Reste computes the real number and shows the arithmetic.

## What makes it trustworthy

- **Tariffs are dated data, not constants.** The GP consultation moved from
  €26.50 to €30 in December 2024; the flat contribution went from €1 to €2 in
  May 2024. Every rate is stored with a validity period and a source, and every
  calculation is made *as of a date*. Hardcoded figures go stale silently — and
  a silently wrong money figure is the one thing this product cannot afford.
- **Every step is shown with its source.** The result is not a black box: base,
  state share, flat contribution, insurer top-up and the overrun are listed
  individually, each pointing at where the number comes from.
- **It says estimate, never guarantee.** Only ameli.fr and your own contract
  are authoritative, and the UI repeats that.

## Stack

Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript strict ·
expo-router · Zustand + AsyncStorage · react-native-svg · trilingual
(fr/en/ru, parity enforced by the type system).

## Domain model

```
src/domain/
  tariffs.ts        dated tariff reference: acts, bases, rates, sources
  reimbursement.ts  the calculation engine (pure, no RN dependencies)
  matching.ts       reconciles a scanned quote against the reference
  compare.ts        scenario comparison against the zero-out-of-pocket basket
  ceilings.ts       annual ceiling status and year-end expiry
  __tests__/        67 cases, verified against published ameli examples
```

**The quote is the source of truth.** French dental and optical quotes are
legally required to print the reimbursement base, so the scanner reads it off
the document rather than relying on a bundled catalogue. The reference is used
to cross-check: when the printed base disagrees with the official tariff, the
app shows both numbers instead of silently picking one.

Calculation order mirrors how the state actually settles a claim:
reimbursement base → rate (70 % / 30 % outside the care pathway / 100 % for
long-term conditions) → flat contribution deducted → insurer tops up to its
ceiling → whatever is left is yours.

Lines in one quote are settled **in sequence, not independently**: the annual
ceiling and the daily caps on the flat contribution are a shared budget. The
second crown in the same document sees the ceiling the first one already used.
Being generous per line and wrong per quote is the failure this product exists
to expose.

A long-term condition (ALD) and an exemption from the flat contribution are
tracked as two separate facts. ALD reimburses 100 % of the base, but the €2 is
still owed — collapsing the two understates the cost for the people who see a
doctor most often.

## Two things people find out too late

**Annual ceilings.** A contract advertising “300 % on dental” often carries a
€400 yearly cap, usually in a footnote. The second crown of the year is barely
covered at all. The contract scanner looks for those caps specifically, you
record what has already been reimbursed this year, and the shortfall appears as
its own line in the breakdown rather than disappearing into the total. Ceilings
reset on 31 December and do not roll over, so the app mentions the deadline in
the last quarter — stated once, as a fact, with no countdown and no urgency:
this is medical spending, not a sale.

**The zero-out-of-pocket basket.** Since 2020 a dentist is legally required to
put the *100 % Santé* option on the quote whenever it is technically possible.
Reste computes what that option would cost you — usually nothing — and shows
the gap against what you were quoted. If the option is missing from your quote,
that is worth a question.

Deliberately absent: “average price in your area”. No open dataset supports
that with the precision money decisions need, and an invented figure is worse
than none. Every comparison here is derived from the bases printed on your own
document.

Full architecture and design decisions: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Getting started

```bash
npm install
npx expo start
npm test          # domain engine
npm run typecheck # types + locale parity
npm run lint
npm run check:dead # logic no screen can reach
npm run check:i18n # every key a screen asks for exists in all three dicts
```

## Status

Working end to end on mock data: scan a quote, scan or hand-enter your coverage
table, get the breakdown. The Anthropic key stays server-side in two Supabase
edge functions (`parse-devis`, `parse-contract`); `EXPO_PUBLIC_MOCK_AI=1` runs
the whole app without a backend.

Not built yet: reading paper reimbursement statements so the ledger fills
itself, and the full CCAM catalogue — the bundled list is deliberately short,
since the real one has thousands of codes and belongs on a server.

Annual ceilings are complete end to end: read from the contract, corrected by
hand where the parse misses the footnote, recorded per payment in the ledger,
subtracted in the calculation, and shown as their own line in the breakdown.

## Disclaimer

Reste is an information tool, not insurance advice. It does not sell, compare
or recommend insurance products.

---

Built by [Maksim Miliutin](https://github.com/maksim-miliutin) · [LinkedIn](https://www.linkedin.com/in/maksim-milyutin-9b0b05418/)
