import { readFileSync } from "node:fs";

const src = readFileSync("src/data/narrative/points.ts", "utf-8");
const locales = ["Ru", "En", "Tr", "Es", "Pt", "De", "Fr"];
const LIMIT = 95;

let total = 0;
let overflow = 0;

console.log(`Locale | count | max | over-${LIMIT}`);
console.log("-------+-------+-----+--------");

for (const loc of locales) {
  const re = new RegExp(`desc${loc}:\\s*"((?:[^"\\\\]|\\\\.)+)"`, "g");
  const arr = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    // unescape \" \\ \n
    const s = m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\n/g, "\n");
    arr.push(s);
  }
  total += arr.length;
  const max = arr.reduce((acc, s) => Math.max(acc, s.length), 0);
  const over = arr.filter((s) => s.length > LIMIT);
  console.log(`${loc.padEnd(6)} | ${String(arr.length).padStart(5)} | ${String(max).padStart(3)} | ${over.length}`);
  if (over.length > 0) {
    overflow += over.length;
    over.forEach((s) => console.log(`  [${s.length}] ${s}`));
  }
}

console.log("-------+-------+-----+--------");
console.log(`Total: ${total}, Over ${LIMIT}: ${overflow}`);

// Also: top 5 longest per locale to spot near-limit cases
console.log("\nTop-5 longest per locale:");
for (const loc of locales) {
  const re = new RegExp(`desc${loc}:\\s*"((?:[^"\\\\]|\\\\.)+)"`, "g");
  const arr = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const s = m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\n/g, "\n");
    arr.push(s);
  }
  arr.sort((a, b) => b.length - a.length);
  console.log(`\n[${loc}] top-5:`);
  arr.slice(0, 5).forEach((s) => console.log(`  [${s.length}] ${s}`));
}
