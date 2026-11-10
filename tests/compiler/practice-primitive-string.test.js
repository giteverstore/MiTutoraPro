import { describe, expect, it } from 'vitest';
import q250 from '../../src/practice/data/q250PracticeQuestions.json';
import { createPracticeFunctionHarness } from '../../src/compiler/function-mode/containsDuplicateHarness';
import { resolvePracticeExecutionContract } from '../../src/compiler/function-mode/functionExecutionContract';
import { createFunctionExecutionStrategy } from '../../src/compiler/function-mode/functionExecutionStrategy';
import { executeJavaScriptSource } from '../../src/compiler/runtimes/javascript/javascriptExecution';

const ids = ['002', '010', '016', '017', '018', '019', '021', '064', '104', '112', '113', '114', '115', '116', '118', '119', '120', '121', '126', '128', '129', '144', '145', '146', '147', '148', '149'].map((suffix) => `BLIND150-${suffix}`);

describe('large primitive Mode B activation batch', () => {
  it.each(ids)('%s stays a three-fixture exact plain-return contract', (id) => {
    const question = q250.find((entry) => entry.id === id);
    expect(resolvePracticeExecutionContract(question)).toMatchObject({ questionId: id, adapter: 'plain-return', validation: { type: 'exact' } });
    expect(question.publicTests).toHaveLength(3);
  });

  it.each(['c', 'cpp', 'java', 'csharp', 'python', 'javascript', 'typescript', 'php', 'r'])('generates a JSON-safe scalar-string harness for %s', (language) => {
    const question = q250.find(({ id }) => id === 'BLIND150-019');
    const harness = createPracticeFunctionHarness({ language, source: question.starterTemplates[language], fixture: question.publicTests[0], contract: resolvePracticeExecutionContract(question) });
    expect(harness).toContain('minWindow');
    expect(harness).toContain('aab');
    expect(harness).toContain('value');
    if (language === 'c' || language === 'cpp') expect(harness).toContain('__p_str');
    if (language === 'java') expect(harness).toContain('quote(String s)');
    if (language === 'csharp') expect(harness).toContain('Quote(string s)');
    if (language === 'r') expect(harness).toContain('encodeString');
  });

  it('rejects wrong string values without changing exact comparison semantics', async () => {
    const question = q250.find(({ id }) => id === 'BLIND150-019');
    const contract = { ...resolvePracticeExecutionContract(question), fixtures: [question.publicTests[0]] };
    const manager = { execute: async ({ source }) => {
      const result = await executeJavaScriptSource({ source });
      return { status: result.status, output: result.stdout, errors: result.stderr ? [result.stderr] : [], executionTimeMs: 1 };
    } };
    const execution = await createFunctionExecutionStrategy(contract).execute({ compilerManager: manager, definition: { language: 'javascript', editor: { fileName: 'main.js' } }, source: 'function minWindow(){return "wrong"}', signal: new AbortController().signal, instanceId: 'wrong-string' });
    expect(execution.allPassed).toBe(false);
    expect(execution.functionResults[0]).toMatchObject({ status: 'wrong_answer', actual: 'wrong', expected: 'aab' });
  });

  it.each([
    [[]], [['one']], [['one', 'two']], [['']], [['quote"']], [['back\\slash']], [['dup', 'dup']],
  ])('preserves generic string-array input %j without question-specific branches', (values) => {
    const contract = {
      questionId: 'SYNTHETIC-STRING-ARRAY', adapter: 'plain-return', callable: { name: 'sizeOf', className: 'Solution' },
      arguments: [{ index: 0, type: 'string-array' }], returns: { type: 'integer' }, mutation: { target: null },
      serialization: { format: 'json', bounded: false }, validation: { type: 'exact' },
    };
    const sources = {
      c: 'typedef struct{unsigned char*data;size_t len;}ByteString;typedef struct{ByteString*data;size_t len;}StringArray;int32_t sizeOf(StringArray a){return a.len;}',
      cpp: '#include <string>\n#include <vector>\nint sizeOf(std::vector<std::string>a){return a.size();}',
      java: 'public class Solution{public int sizeOf(String[]a){return a.length;}}',
      csharp: 'public class Solution{public int sizeOf(string[]a){return a.Length;}}',
      python: 'def sizeOf(a): return len(a)', javascript: 'function sizeOf(a){return a.length}', typescript: 'function sizeOf(a:string[]):number{return a.length}',
      php: '<?php function sizeOf(array $a):int{return count($a);}', r: 'sizeOf<-function(a)length(a)',
    };
    for (const [language, source] of Object.entries(sources)) {
      const harness = createPracticeFunctionHarness({ language, source, fixture: { arguments: [values], expected: values.length }, contract });
      expect(harness).toContain('sizeOf');
      expect(harness).toContain('value');
      if (language === 'c') expect(harness).toContain(`StringArray a0={r0,${values.length}}`);
    }
  });

  it.each(['c', 'cpp', 'java', 'csharp', 'python', 'javascript', 'typescript', 'php', 'r'])('generates generic primitive matrix input and output for %s', (language) => {
    const question = q250.find(({ id }) => id === 'BLIND150-130');
    const harness = createPracticeFunctionHarness({ language, source: question.starterTemplates[language], fixture: question.publicTests[0], contract: resolvePracticeExecutionContract(question) });
    expect(harness).toContain('insertInterval');
    expect(harness).toContain('value');
    if (language === 'c') expect(harness).toContain('__p_mat');
    if (language === 'r') {
      expect(harness).toContain('lapply(list(');
      expect(harness).toContain('.jsonrows(v)');
    }
  });
});
