import { describe, expect, it, vi } from 'vitest';
import q250 from '../../src/practice/data/q250PracticeQuestions.json';
import { ACTIVATED_FUNCTION_QUESTION_IDS, resolvePracticeExecutionContract } from '../../src/compiler/function-mode/functionExecutionContract';
import { createContainsDuplicateHarness, RESULT_PREFIX } from '../../src/compiler/function-mode/containsDuplicateHarness';
import { createFunctionExecutionStrategy } from '../../src/compiler/function-mode/functionExecutionStrategy';
import { executeJavaScriptSource } from '../../src/compiler/runtimes/javascript/javascriptExecution';
import { JavaScriptRuntime } from '../../src/compiler/runtimes/javascript/JavaScriptRuntime';
import { TypeScriptRuntime } from '../../src/compiler/runtimes/typescript/TypeScriptRuntime';

const question = q250.find(({ id }) => id === 'BLIND150-001');
const contract = resolvePracticeExecutionContract(question);
const languages = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'r'];

describe('Practice Mode B function execution', () => {
  it('activates only the accepted family matrix', () => {
    expect(contract).toMatchObject({ version: 'practice-function-v1', executionMode: 'function', questionId: 'BLIND150-001' });
    expect(contract.fixtures).toHaveLength(3);
    expect(resolvePracticeExecutionContract(q250.find(({ id }) => id === 'BLIND150-002'))).toMatchObject({ adapter: 'plain-return' });
    expect(q250.filter((entry) => resolvePracticeExecutionContract(entry))).toHaveLength(191);
    expect(ACTIVATED_FUNCTION_QUESTION_IDS).toHaveLength(191);
    expect(ACTIVATED_FUNCTION_QUESTION_IDS).toEqual(expect.arrayContaining([
      'BLIND150-046',
      'BLIND150-047',
      'BLIND150-048',
      'BLIND150-049',
      'BLIND150-050',
      'BLIND150-051',
      'BLIND150-052',
      'BLIND150-053',
      'BLIND150-057',
      'BLIND150-059',
      'BLIND150-054',
      'BLIND150-055',
      'BLIND150-056',
      'BLIND150-058',
      'NC250-193',
      'NC250-194',
      'NC250-195',
      'NC250-199',
      'NC250-200',
      'NC250-198',
      'NC250-196',
      'NC250-197',
      'NC250-158',
      'NC250-208',
      'NC250-215',
      'BLIND150-002',
      'BLIND150-008',
      'BLIND150-019',
      'BLIND150-023',
      'BLIND150-084',
      'BLIND150-090',
      'BLIND150-130',
      'BLIND150-149',
      'BLIND150-004',
      'BLIND150-062',
      'BLIND150-074',
      'BLIND150-141',
    ]));
  });

  it.each(languages)('generates a hidden %s adapter that invokes the learner function', (language) => {
    const source = question.starterTemplates[language];
    const harness = createContainsDuplicateHarness({ language, source, fixture: contract.fixtures[0] });
    expect(harness).toContain(source.replace(/\?>\s*$/, ''));
    expect(harness).toContain('containsDuplicate');
    expect(harness).toContain(RESULT_PREFIX);
    expect(harness).toContain('8');
  });

  it('runs all public fixtures and validates typed boolean results', async () => {
    const outputs = [true, false, false];
    const compilerManager = { execute: vi.fn(async () => ({ status: 'success', output: `${RESULT_PREFIX}${JSON.stringify({ value: outputs.shift() })}`, errors: [], executionTimeMs: 2 })) };
    const strategy = createFunctionExecutionStrategy(contract);
    const execution = await strategy.execute({ compilerManager, definition: { language: 'javascript', editor: { fileName: 'main.js' } }, source: question.starterTemplates.javascript, signal: new AbortController().signal, instanceId: 'test' });
    expect(compilerManager.execute).toHaveBeenCalledTimes(3);
    expect(execution.allPassed).toBe(true);
    expect(execution.functionResults.every(({ passed }) => passed)).toBe(true);
    expect(strategy.validate({ execution })).toBe(true);
  });

  it.each(['javascript', 'typescript'])('executes a correct %s solution through the real browser-language engine', async (language) => {
    const javascriptRuntime = new JavaScriptRuntime({ client: { initialize: vi.fn(), execute: executeJavaScriptSource, reset: vi.fn(), dispose: vi.fn() } });
    const runtime = language === 'typescript' ? new TypeScriptRuntime({ javascriptRuntime }) : javascriptRuntime;
    const compilerManager = { execute: vi.fn(async (request) => runtime.execute(request)) };
    const source = language === 'typescript'
      ? 'function containsDuplicate(nums: number[]): boolean { return new Set(nums).size !== nums.length; }'
      : 'function containsDuplicate(nums) { return new Set(nums).size !== nums.length; }';
    const execution = await createFunctionExecutionStrategy(contract).execute({ compilerManager, definition: { language, editor: { fileName: `main.${language === 'typescript' ? 'ts' : 'js'}` } }, source, signal: new AbortController().signal, instanceId: 'test' });
    expect(execution).toMatchObject({ status: 'success', allPassed: true });
    expect(execution.functionResults).toHaveLength(3);
  });

  it('keeps wrong answers distinct from infrastructure errors', async () => {
    const compilerManager = { execute: vi.fn(async () => ({ status: 'success', output: `${RESULT_PREFIX}{"value":false}`, errors: [], executionTimeMs: 1 })) };
    const execution = await createFunctionExecutionStrategy(contract).execute({ compilerManager, definition: { language: 'javascript', editor: { fileName: 'main.js' } }, source: 'function containsDuplicate(){ return false; }', signal: new AbortController().signal, instanceId: 'test' });
    expect(execution.allPassed).toBe(false);
    expect(execution.functionResults[0]).toMatchObject({ status: 'wrong_answer', actual: false, expected: true });
    expect(execution.errors).toEqual([]);
  });

  it('normalizes compile, runtime, timeout, adapter, serialization and cancellation outcomes', async () => {
    const run = async (manager, language = 'javascript', signal = new AbortController().signal) => createFunctionExecutionStrategy(contract).execute({ compilerManager: manager, definition: { language, editor: { fileName: 'main.js' } }, source: 'source', signal, instanceId: 'test' });
    expect((await run({ execute: vi.fn(async () => ({ status: 'error', output: '', errors: ['Syntax compile error'], executionTimeMs: 0 })) })).functionResults[0].status).toBe('compilation_error');
    expect((await run({ execute: vi.fn(async () => ({ status: 'error', output: '', errors: ['Runtime exploded'], executionTimeMs: 0 })) })).functionResults[0].status).toBe('runtime_error');
    expect((await run({ execute: vi.fn(async () => { throw new Error('Execution exceeded 10 ms.'); }) })).functionResults[0].status).toBe('timeout');
    expect((await run({ execute: vi.fn(async () => ({ status: 'success', output: 'not serialized', errors: [], executionTimeMs: 0 })) })).functionResults[0].status).toBe('serialization_error');
    expect((await run({ execute: vi.fn() }, 'unknown')).functionResults[0].status).toBe('adapter_error');
  });
});
