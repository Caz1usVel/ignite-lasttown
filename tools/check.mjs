// 全ての .js / .mjs に node --check をかける（公開前の機械チェック）
import { readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOTS = ['js', 'tools', 'tests'];
const EXTS = new Set(['.js', '.mjs']);

function walk(dir, out) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(ent.name))) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => {
  try { return walk(r, []); } catch { return []; }
});
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    failed++;
    console.error(`NG ${f}\n${r.stderr}`);
  }
}
console.log(`node --check: ${files.length - failed}/${files.length} OK`);
process.exit(failed ? 1 : 0);
