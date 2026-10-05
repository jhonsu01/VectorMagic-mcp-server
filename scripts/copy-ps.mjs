// Copies the PowerShell engine next to the compiled output and checks it is pure ASCII
// (Windows PowerShell 5.1 reads BOM-less .ps1 files in the ANSI code page).
import { cpSync, readdirSync, readFileSync } from 'fs';

cpSync('src/ps', 'dist/ps', { recursive: true });
for (const f of readdirSync('src/ps')) {
  const buf = readFileSync(`src/ps/${f}`);
  const bad = buf.findIndex((b) => b > 0x7f);
  if (bad >= 0) {
    const line = buf.subarray(0, bad).toString('latin1').split('\n').length;
    console.error(`src/ps/${f}: non-ASCII byte at line ${line}. Keep the engine pure ASCII.`);
    process.exit(1);
  }
}
console.log('copied src/ps -> dist/ps');
