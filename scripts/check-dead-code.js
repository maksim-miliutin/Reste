/**
 * Finds code that cannot be reached from the UI.
 *
 * This happened three times during development: logic written, tests green,
 * and nothing to fill the field or trigger the action. A normal linter misses
 * it — formally everything is "used" within its module.
 *
 * Run: npm run check:dead
 */
const fs = require('fs');
const cp = require('child_process');

const files = cp
  .execSync("find app src -name '*.ts' -o -name '*.tsx'", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter((f) => !f.includes('__tests__'));

const sources = files.map((f) => ({ f, src: fs.readFileSync(f, 'utf8') }));
const corpus = sources.map((x) => x.src).join('\n');

const unusedExports = [];
for (const { f, src } of sources) {
  if (!/src\/(domain|services|utils)/.test(f)) continue;
  for (const m of src.matchAll(/^export (?:async )?function (\w+)|^export const (\w+)/gm)) {
    const name = m[1] || m[2];
    const uses = [...corpus.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length;
    if (uses <= 1) unusedExports.push(`${name} (${f})`);
  }
}

const store = fs.readFileSync('src/store/useAppStore.ts', 'utf8');
const screens = cp
  .execSync("find app -name '*.tsx'", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');

const unreachableActions = [...store.matchAll(/^ {2}(\w+): \(/gm)]
  .map((m) => m[1])
  .filter((a) => !new RegExp(`\\b${a}\\b`).test(screens));

if (unusedExports.length === 0 && unreachableActions.length === 0) {
  console.log('No dead code.');
  process.exit(0);
}

if (unusedExports.length) console.log('Unused exports:\n  ' + unusedExports.join('\n  '));
if (unreachableActions.length) console.log('Store actions with no UI:\n  ' + unreachableActions.join('\n  '));
process.exit(1);
