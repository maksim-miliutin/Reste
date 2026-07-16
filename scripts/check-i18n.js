/**
 * Verifies that every key the screens ask t() for exists in all three
 * dictionaries.
 *
 * Why a separate script: type parity (en: typeof fr) guarantees the shape of
 * dictionaries, not that the shape is correct. A real case:
 * the `compare` block was left unclosed, so `ledger`, `expiry`, `settings`,
 * `review` оказались вложены внутрь него — во всех трёх файлах одинаково.
 * Types matched, `tsc --noEmit` stayed silent, and half the app rendered
 * raw keys like `settings.title`. Only a check of the form "the key the
 * code asks for resolves in the dictionary" catches this.
 *
 * Run: npm run check:i18n
 */
const fs = require('fs');
const cp = require('child_process');
const ts = require('typescript');

// ── словари ──────────────────────────────────────────────────
function loadDict(lang) {
  const raw = fs
    .readFileSync(`src/i18n/locales/${lang}.ts`, 'utf8')
    .replace(/import type[^\n]*\n/g, '')
    .replace(/export const \w+(: typeof \w+)? =/, 'module.exports =');
  const js = ts.transpileModule(raw, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', js)(mod, mod.exports);
  return mod.exports;
}

const LANGS = ['fr', 'en', 'ru'];
const dicts = Object.fromEntries(LANGS.map((l) => [l, loadDict(l)]));

const has = (dict, key) => {
  let cur = dict;
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null || !(part in cur)) return false;
    cur = cur[part];
  }
  return typeof cur === 'string';
};

const flatten = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${p}${k}.`) : [`${p}${k}`],
  );

// ── ключи, которые просит код ────────────────────────────────
const files = cp
  .execSync("find app src -name '*.ts' -o -name '*.tsx'", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter((f) => !f.includes('__tests__') && !f.includes('/i18n/locales/'));

const used = new Set();

/**
 * Dynamic key families: the code builds them from a template
 * (`t(\`step.${step.key}\`)`), поэтому статически они не видны. Списки
 * mirroring domain type unions — if a new value appears there,
 * but not here, the check will miss it, so the source is noted alongside.
 */
const DYNAMIC = {
  // Step['key'] из src/domain/reimbursement.ts
  step: ['base', 'securiteSociale', 'participation', 'franchise', 'mutuelle', 'ceiling', 'overrun'],
  // CareCategory из src/domain/tariffs.ts
  category: [
    'consultation', 'specialist', 'dental', 'optical', 'hospital',
    'lab', 'radiology', 'pharmacy', 'other',
  ],
  // Sector из src/domain/tariffs.ts
  sector: ['secteur1', 'secteur2_optam', 'secteur2'],
  // Scenario['key'] из src/domain/compare.ts
  compare: ['quote', 'zeroRac', 'custom'],
};

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  // literal calls: t('a.b')
  for (const m of src.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) used.add(m[1]);
  // key chosen inside the call: t(cond ? 'scan.quota' : 'scan.failed')
  for (const call of src.matchAll(/\bt\(([^)\n]*)\)/g)) {
    for (const lit of call[1].matchAll(/'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)'/g)) used.add(lit[1]);
  }
  // templates: t(`step.${...}`) → expand the known family
  for (const m of src.matchAll(/\bt\(\s*`([A-Za-z0-9_.]*)\.\$\{/g)) {
    const family = m[1];
    const values = DYNAMIC[family];
    if (!values) {
      console.log(`Unknown key family \`${family}.\${…}\` in ${file}.`);
      console.log('  Add it to DYNAMIC in scripts/check-i18n.js.');
      process.exit(1);
    }
    for (const v of values) used.add(`${family}.${v}`);
  }
}

// ── отчёт ────────────────────────────────────────────────────
const missing = [];
for (const key of [...used].sort()) {
  const absent = LANGS.filter((l) => !has(dicts[l], key));
  if (absent.length) missing.push(`${key} — нет в: ${absent.join(', ')}`);
}

const all = LANGS.map((l) => flatten(dicts[l]).sort());
const parity = all.every((k) => JSON.stringify(k) === JSON.stringify(all[0]));

const unused = flatten(dicts.fr)
  .filter((k) => !used.has(k))
  .sort();

if (missing.length === 0 && parity) {
  console.log(`i18n keys resolve: ${used.size} requested, ${all[0].length} in dictionary.`);
  if (unused.length) console.log('Unused (not an error):\n  ' + unused.join('\n  '));
  process.exit(0);
}

if (!parity) console.log('Dictionaries differ in key sets.');
if (missing.length) console.log('Keys missing from dictionaries:\n  ' + missing.join('\n  '));
process.exit(1);
