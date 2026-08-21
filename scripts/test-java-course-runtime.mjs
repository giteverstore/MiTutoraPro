import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TeaVMJavaEngine } from '../src/compiler/runtimes/java/TeaVMJavaEngine.js';
import { NormalizedOutputValidator } from '../src/compiler/validators/NormalizedOutputValidator.js';
import { createCompilerManager } from '../src/compiler/createCompilerManager.js';
import { normalizeCompilerDefinition } from '../src/compiler/core/normalizeCompilerDefinition.js';

const course = JSON.parse(await readFile(resolve('public/courses/java-course.json'), 'utf8'));
const lessons = course.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons));
const vendorRoot = resolve('public/vendor/teavm-javac');
const engine = new TeaVMJavaEngine({
  loadAsset: async (name) => new Uint8Array(await readFile(resolve(vendorRoot, name))),
  loadRuntimeModule: () => import(pathToFileURL(resolve(vendorRoot, 'compiler.wasm-runtime.js')).href),
});
const validator = new NormalizedOutputValidator();
const manager = createCompilerManager();
const representativeLessons = ['1.1.6', '1.4.13', '1.7.6', '2.2.13', '2.5.12', '3.1.14', '4.1.18', '4.2.4', '4.2.8', '5.2.11'];
const results = [];

for (const number of representativeLessons) {
  const lesson = lessons.find((candidate) => candidate.number === number);
  assert(lesson, `Representative lesson ${number} is missing.`);
  const compiler = lesson.blocks.find((block) => block.type === 'compiler');
  const solution = lesson.blocks.find((block) => block.type === 'solution');
  assert(compiler && solution, `Lesson ${number} must have compiler and solution blocks.`);
  const execution = await engine.execute({
    source: solution.code,
    stdin: compiler.stdin,
    filename: compiler.activeFile,
    execution: compiler.execution,
  });
  assert.equal(execution.status, 'success', `${number} failed: ${execution.stderr}`);
  const definition = normalizeCompilerDefinition(compiler);
  const matches = definition.validatorType === 'normalized_output'
    ? validator.validate(compiler.expectedOutput, execution.stdout)
    : manager.validateOutput({
      expectedOutput: compiler.expectedOutput,
      programOutput: execution.stdout,
      validatorType: definition.validatorType,
      validatorOptions: definition.validatorOptions,
    });
  assert(matches, `${number} output differs from its validation rule.`);
  results.push({ number, title: lesson.title, status: 'passed' });
}

engine.dispose();
console.log(JSON.stringify({ representativeExercises: results.length, results }, null, 2));
