import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const course = JSON.parse(await read('public/courses/python-course.json'));
const lessons = course.modules.flatMap((module) =>
  module.sections?.flatMap((section) => section.lessons) ?? module.lessons ?? []);
const blocks = lessons.flatMap((lesson) => lesson.blocks);
const codeBlocks = blocks.filter(({ type }) => type === 'code');
const runnableExamples = codeBlocks.filter(({ mode }) => mode === 'runnable');
const displayExamples = codeBlocks.filter(({ mode }) => mode === 'display');
const tableBlocks = blocks.filter(({ type }) => type === 'table');
const layout = await read('src/components/Layout.jsx');
const panel = await read('src/components/CompilerPanel.jsx');
const codeBlock = await read('src/components/blocks/CodeBlock.jsx');
const editorHeader = await read('src/components/EditorHeader.jsx');
const manager = await read('src/compiler/core/CompilerManager.js');
const app = await read('src/App.jsx');
const styles = await read('src/styles.css');

assert.equal(runnableExamples.length, 62, 'The reviewed Python course must preserve its explicit runnable examples.');
assert.equal(displayExamples.length, 83, 'Syntax, output, quiz, and reference code must remain display-only.');
assert.ok(codeBlocks.every(({ mode }) => ['display', 'runnable'].includes(mode)), 'Every Python code example requires an explicit supported mode.');
assert.equal(codeBlocks.find(({ code }) => code === '"This is a string."')?.mode, 'display', 'A bare string example must not expose Run Code.');
assert.equal(codeBlocks.find(({ code }) => code.includes('print("This is a string.")'))?.mode, 'runnable', 'The visible-output string example must remain runnable.');
assert.ok(tableBlocks.every((table) => !/Run\s*Code\s*>>/i.test(JSON.stringify(table))), 'DOCX Run Code controls must never become table content.');
assert.ok(codeBlocks.every(({ code }) => !/^Run\s*Code\s*>>$/im.test(code)), 'DOCX Run Code controls must never become code content.');
assert.equal(codeBlocks.find(({ code }) => code === 'print("welcome to Go Coder")')?.mode, 'display', 'A DOCX layout table must become one display example without duplicated controls.');
assert.match(codeBlock, /mode === 'runnable'/, 'CodeBlock must gate its action with explicit mode metadata.');
assert.match(codeBlock, /learningCompiler\.runExample/, 'Examples must delegate to the learning compiler.');
assert.match(editorHeader, /<IconButton label="Reset code"/, 'Reset must use the accessible compact icon control.');
assert.match(editorHeader, /className="compiler-run-button"[\s\S]*?label="Run code"/, 'Run must use the accessible compact icon control.');
assert.match(layout, /LearningCompilerProvider/, 'The learning layout must provide the compiler bridge.');
assert.match(layout, /isCompilerMinimized/, 'The learning compiler must expose minimized state.');
assert.match(layout, /aria-expanded="false"/, 'The minimized dock control must expose its collapsed state.');
assert.match(layout, /onExecutionStateChange=\{setCompilerStatus\}/, 'The dock must reflect compiler execution state.');
assert.match(layout, /<CompilerPanel\s+ref=\{compilerPanelRef\}/, 'The persistent panel must have one stable learning-layout instance.');
assert.match(styles, /\.compiler-dock\.is-minimized[\s\S]*?top:\s*var\(--space-4\);[\s\S]*?width:\s*7\.5rem;[\s\S]*?height:\s*3\.25rem;/, 'The minimized compiler must remain a compact top-right dock.');
assert.match(styles, /\.workspace\.has-compiler\s*\{[^}]*var\(--compiler-width\)/, 'The expanded compiler must occupy its own workspace grid column.');
assert.doesNotMatch(styles, /\.desktop-compiler\s*\{[^}]*position:\s*fixed/, 'The expanded compiler must not overlap lesson content.');
assert.doesNotMatch(styles, /compiler-width\),\s*42vw/, 'The compiler pane must not be constrained by a percentage split.');
assert.match(layout, /max=\{compilerMaxWidth\}/, 'The compiler divider must use the available workspace width as its functional boundary.');
assert.match(panel, /useImperativeHandle/, 'The persistent panel must accept example load requests without another runtime.');
assert.match(panel, /currentCodeRef\.current !== lastLoadedCodeRef\.current/, 'Learner edits require semantic dirty detection.');
assert.match(panel, /Replace the current code with this example\?/, 'Dirty learner code must require confirmation.');
assert.match(manager, /runtimeInitialization = new WeakMap/, 'CompilerManager must deduplicate runtime initialization.');
assert.equal((app.match(/createCompilerManager\(\)/g) ?? []).length, 1, 'The application must create one CompilerManager.');

console.log(JSON.stringify({
  runnableExamples: runnableExamples.length,
  displayExamples: displayExamples.length,
  persistentPanel: 'passed',
  dirtyProtection: 'passed',
  runtimeDeduplication: 'passed',
}, null, 2));
