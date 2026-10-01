import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const baseUrl = server.resolvedUrls?.local?.[0];
if (!baseUrl) throw new Error('Unable to resolve native stdin acceptance URL.');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (message) => console.log(`browser:${message.type()}: ${message.text()}`));
page.on('pageerror', (error) => console.log(`browser:pageerror: ${error.message}`));

async function open(slug, label) {
  await page.goto(`${baseUrl}__compiler/${slug}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.getByLabel(`${label} source editor`).waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(await page.evaluate(() => crossOriginIsolated), true);
}

async function setSource(label, source) {
  const editor = page.getByLabel(`${label} source editor`);
  await editor.click({ force: true });
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(source);
}

async function setBufferedInput(value) {
  await page.getByRole('button', { name: 'Input' }).click();
  await page.getByRole('textbox', { name: 'Standard input' }).fill(value);
  await page.getByRole('button', { name: 'Close standard input' }).click();
}

async function submit(value, timeout = 120_000) {
  const state = await Promise.race([
    page.locator('.standalone-result-status', { hasText: 'Waiting for input' }).waitFor({ timeout }).then(() => 'waiting'),
    page.locator('.standalone-result-status', { hasText: 'Error' }).waitFor({ timeout }).then(() => 'error'),
  ]);
  if (state === 'error') throw new Error(`Native execution failed: ${await page.locator('.standalone-terminal-content').textContent()}`);
  const input = page.getByLabel('Program input');
  await input.fill(value);
  const startedAt = performance.now();
  await input.press('Enter');
  return startedAt;
}

async function waitForSuccess(timeout = 120_000) {
  await page.locator('.standalone-result-status', { hasText: 'Success' }).waitFor({ timeout });
  await page.getByRole('tab', { name: 'Output' }).click();
  return page.locator('.standalone-terminal-content').textContent();
}

async function minimal({ slug, label, source, value, expected }) {
  await open(slug, label);
  await setSource(label, source);
  await setBufferedInput('');
  const coldStartedAt = performance.now();
  await page.getByRole('button', { name: 'Run' }).click();
  const submittedAt = await submit(value);
  const output = await waitForSuccess();
  const completedAt = performance.now();
  assert.match(output, expected);
  return { coldMs: Math.round(completedAt - coldStartedAt), resumeMs: Math.round(completedAt - submittedAt) };
}

async function interactiveCase({ slug, label, source, buffered = '', submissions, expected, prompt }) {
  await open(slug, label);
  await setSource(label, source);
  await setBufferedInput(buffered);
  await page.getByRole('button', { name: 'Run' }).click();
  for (const [index, value] of submissions.entries()) {
    await page.locator('.standalone-result-status', { hasText: 'Waiting for input' }).waitFor({ timeout: 120_000 });
    if (index === 0 && prompt) assert.match(await page.locator('.standalone-terminal-content').textContent(), prompt);
    await submit(value);
  }
  assert.match(await waitForSuccess(), expected);
}

async function cancelCase({ slug, label, waitingSource, recoverySource, recoveryExpected }) {
  await open(slug, label);
  await setSource(label, waitingSource);
  await setBufferedInput('');
  await page.getByRole('button', { name: 'Run' }).click();
  await page.locator('.standalone-result-status', { hasText: 'Waiting for input' }).waitFor({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.locator('.standalone-result-status', { hasText: 'Cancelled' }).waitFor();
  assert.equal(await page.getByLabel('Program input').count(), 0);
  await setSource(label, recoverySource);
  await page.getByRole('button', { name: 'Run' }).click();
  assert.match(await waitForSuccess(), recoveryExpected);
}

try {
  const c = await minimal({
    slug: 'c', label: 'C', value: 'C', expected: /C/,
    source: '#include <stdio.h>\nint main(void) { int c = getchar(); putchar(c); return 0; }',
  });
  const cpp = await minimal({
    slug: 'cpp', label: 'C++', value: 'P', expected: /P/,
    source: '#include <iostream>\nint main() { char c; std::cin.get(c); std::cout.put(c); }',
  });
  await interactiveCase({
    slug: 'c', label: 'C', submissions: ['42'], prompt: /Number:/, expected: /Number:\s*42\s*42/,
    source: '#include <stdio.h>\nint main(void) { int n; printf("Number: "); fflush(stdout); scanf("%d", &n); printf("%d\\n", n); }',
  });
  await interactiveCase({
    slug: 'c', label: 'C', submissions: ['Avi Kumar'], prompt: /Name:/, expected: /Avi Kumar/,
    source: '#include <stdio.h>\nint main(void) { char b[128]; printf("Name: "); fflush(stdout); fgets(b, sizeof b, stdin); printf("%s", b); }',
  });
  await interactiveCase({
    slug: 'c', label: 'C', submissions: ['R'], expected: /R/,
    source: '#include <unistd.h>\n#include <stdio.h>\nint main(void) { char c; if (read(0,&c,1)==1) putchar(c); }',
  });
  await interactiveCase({
    slug: 'c', label: 'C', submissions: ['10', '20'], expected: /10 20/,
    source: '#include <stdio.h>\nint main(void) { int a,b; scanf("%d", &a); scanf("%d", &b); printf("%d %d\\n", a,b); }',
  });
  await interactiveCase({
    slug: 'c', label: 'C', submissions: ['one', 'two', 'quit'], expected: /one[\s\S]*two/,
    source: '#include <stdio.h>\n#include <string.h>\nint main(void) { char b[64]; while (fgets(b,sizeof b,stdin)) { b[strcspn(b,"\\n")]=0; if (!strcmp(b,"quit")) break; puts(b); } }',
  });
  await interactiveCase({
    slug: 'c', label: 'C', buffered: '10', submissions: ['20'], expected: /10 20/,
    source: '#include <stdio.h>\nint main(void) { int a,b; scanf("%d", &a); scanf("%d", &b); printf("%d %d\\n", a,b); }',
  });
  await interactiveCase({
    slug: 'c', label: 'C', submissions: ['こんにちは', 'ನಮಸ್ಕಾರ', 'Avi 🚀'], expected: /こんにちは[\s\S]*ನಮಸ್ಕಾರ[\s\S]*Avi 🚀/,
    source: '#include <stdio.h>\nint main(void) { char b[128]; for(int i=0;i<3;i++){ fgets(b,sizeof b,stdin); printf("%s",b); } }',
  });
  await cancelCase({
    slug: 'c', label: 'C', waitingSource: '#include <stdio.h>\nint main(void){ getchar(); }',
    recoverySource: '#include <stdio.h>\nint main(void){ puts("c recovered"); }', recoveryExpected: /c recovered/,
  });

  await open('c', 'C');
  await setSource('C', '#include <stdio.h>\nint main(void){ fprintf(stderr,"stderr prompt"); fflush(stderr); int c=getchar(); putchar(c); }');
  await setBufferedInput('');
  await page.getByRole('button', { name: 'Run' }).click();
  await page.locator('.standalone-result-status', { hasText: 'Waiting for input' }).waitFor({ timeout: 120_000 });
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /stderr prompt/);
  await submit('E');
  await page.getByRole('button', { name: 'Run' }).waitFor({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Output' }).click();
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /E/);
  await page.getByRole('tab', { name: 'Errors' }).click();
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /stderr prompt/);

  await interactiveCase({
    slug: 'cpp', label: 'C++', submissions: ['42'], prompt: /Number:/, expected: /Number:\s*42\s*42/,
    source: '#include <iostream>\nusing namespace std; int main(){ int n; cout << "Number: " << flush; cin >> n; cout << n << endl; }',
  });
  await interactiveCase({
    slug: 'cpp', label: 'C++', submissions: ['Avi Kumar'], prompt: /Name:/, expected: /Avi Kumar/,
    source: '#include <iostream>\n#include <string>\nusing namespace std; int main(){ string s; cout << "Name: " << flush; getline(cin,s); cout << s << endl; }',
  });
  await interactiveCase({
    slug: 'cpp', label: 'C++', submissions: ['10', '20'], expected: /10 20/,
    source: '#include <iostream>\nusing namespace std; int main(){ int a,b; cin>>a; cin>>b; cout<<a<<" "<<b<<endl; }',
  });
  await interactiveCase({
    slug: 'cpp', label: 'C++', submissions: ['one', 'two', 'quit'], expected: /one[\s\S]*two/,
    source: '#include <iostream>\n#include <string>\nusing namespace std; int main(){ string s; while(getline(cin,s)){ if(s=="quit") break; cout<<s<<endl; } }',
  });
  await interactiveCase({
    slug: 'cpp', label: 'C++', buffered: '10', submissions: ['20'], expected: /10 20/,
    source: '#include <iostream>\nusing namespace std; int main(){ int a,b; cin>>a; cin>>b; cout<<a<<" "<<b<<endl; }',
  });
  await interactiveCase({
    slug: 'cpp', label: 'C++', submissions: ['こんにちは', 'ನಮಸ್ಕಾರ', 'Avi 🚀'], expected: /こんにちは[\s\S]*ನಮಸ್ಕಾರ[\s\S]*Avi 🚀/,
    source: '#include <iostream>\n#include <string>\nusing namespace std; int main(){ string s; for(int i=0;i<3;i++){ getline(cin,s); cout<<s<<endl; } }',
  });
  await cancelCase({
    slug: 'cpp', label: 'C++', waitingSource: '#include <iostream>\nint main(){ std::cin.get(); }',
    recoverySource: '#include <iostream>\nint main(){ std::cout << "cpp recovered\\n"; }', recoveryExpected: /cpp recovered/,
  });
  console.log(JSON.stringify({
    cGetchar: 'passed', cRead: 'passed', cScanf: 'passed', cFgets: 'passed', cMultiple: 'passed', cLoop: 'passed', cBufferedInteractive: 'passed', cUtf8: 'passed', cCancelRecovery: 'passed', stderrStreaming: 'passed',
    cppCinGet: 'passed', cppCin: 'passed', cppGetline: 'passed', cppMultiple: 'passed', cppLoop: 'passed', cppBufferedInteractive: 'passed', cppUtf8: 'passed', cppCancelRecovery: 'passed', c, cpp,
  }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
