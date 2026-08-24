import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const docs = execFileSync('git', ['ls-files', 'docs'], { encoding: 'utf8' }).split(/\r?\n/).filter((file) => file.endsWith('.md'));
const broken = [];
for (const file of docs) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]+)?\)/g)) {
    const target = decodeURIComponent(match[1]);
    if (!existsSync(resolve(dirname(file), target))) broken.push(`${file} -> ${target}`);
  }
}
if (broken.length) throw new Error(`Broken documentation links:\n${broken.join('\n')}`);
console.log(`Documentation consistency validation passed (${docs.length} Markdown files checked).`);
