import { describe, expect, it } from 'vitest';
import q250 from '../../src/practice/data/q250PracticeQuestions.json';
import { resolvePracticeExecutionContract } from '../../src/compiler/function-mode/functionExecutionContract';
import { createPracticeFunctionHarness, RESULT_PREFIX } from '../../src/compiler/function-mode/containsDuplicateHarness';
import { compareFunctionResult } from '../../src/compiler/function-mode/functionResultComparison';
import { createFunctionExecutionStrategy } from '../../src/compiler/function-mode/functionExecutionStrategy';
import { executeJavaScriptSource } from '../../src/compiler/runtimes/javascript/javascriptExecution';

const ids = ['BLIND150-003', 'BLIND150-138', 'BLIND150-034', 'BLIND150-045', 'BLIND150-082', 'BLIND150-022', 'BLIND150-067'];
const languages = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'r'];

describe('Practice Mode B representative families', () => {
  it.each(ids)('%s has a generic versioned contract and three fixtures', (id) => {
    const question = q250.find((entry) => entry.id === id);
    expect(resolvePracticeExecutionContract(question)).toEqual(expect.objectContaining({ version: 'practice-function-v1', executionMode: 'function', fixtures: expect.any(Array) }));
    expect(question.publicTests).toHaveLength(3);
  });

  it.each(ids.flatMap((id) => languages.map((language) => [id, language])))('%s generates an internal %s family harness', (id, language) => {
    const question = q250.find((entry) => entry.id === id);
    const contract = resolvePracticeExecutionContract(question);
    const source = question.starterTemplates[language];
    const harness = createPracticeFunctionHarness({ language, source, fixture: question.publicTests[0], contract });
    if (['java', 'csharp'].includes(language)) {
      expect(harness).toContain(contract.callable.name);
      expect(harness).toContain(source.match(/throw new [^;]+;|return null;/)?.[0] ?? contract.callable.name);
    } else {
      expect(harness).toContain(source.replace(/\?>\s*$/, ''));
    }
    expect(harness).toContain(RESULT_PREFIX);
    expect(harness).not.toBe(source);
  });

  it('validates Two Sum semantically and Subsets independent of ordering', () => {
    const twoSum = q250.find(({ id }) => id === 'BLIND150-003').publicTests[0];
    expect(compareFunctionResult({ policy: 'two-sum', actual: [3, 2], expected: twoSum.expected, fixture: twoSum })).toBe(true);
    expect(compareFunctionResult({ policy: 'two-sum', actual: [0, 1], expected: twoSum.expected, fixture: twoSum })).toBe(false);
    expect(compareFunctionResult({ policy: 'unordered-nested', actual: [[-1, 3], [], [3], [-1]], expected: [[], [3], [-1], [3, -1]], fixture: {} })).toBe(true);
  });

  const javascriptSolutions = {
    'BLIND150-003': 'function twoSum(a,t){for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]+a[j]===t)return[i,j]}',
    'BLIND150-138': 'function setZeroes(m){const r=new Set(),c=new Set();m.forEach((x,i)=>x.forEach((v,j)=>{if(v===0){r.add(i);c.add(j)}}));m.forEach((x,i)=>x.forEach((_,j)=>{if(r.has(i)||c.has(j))m[i][j]=0}))}',
    'BLIND150-034': 'class ListNode{constructor(val=0,next=null){this.val=val;this.next=next}} function reverseList(h){let p=null;while(h){const n=h.next;h.next=p;p=h;h=n}return p}',
    'BLIND150-045': 'class TreeNode{constructor(val=0,left=null,right=null){this.val=val;this.left=left;this.right=right}} function invertTree(r){if(!r)return r;[r.left,r.right]=[invertTree(r.right),invertTree(r.left)];return r}',
    'BLIND150-082': 'class GraphNode{constructor(val=0,neighbors=[]){this.val=val;this.neighbors=neighbors}} function cloneGraph(n,m=new Map()){if(!n)return null;if(m.has(n))return m.get(n);const c=new GraphNode(n.val);m.set(n,c);c.neighbors=n.neighbors.map(x=>cloneGraph(x,m));return c}',
    'BLIND150-022': 'class MinStack{constructor(){this.a=[]}push(x){this.a.push(x)}pop(){this.a.pop()}top(){return this.a.at(-1)}getMin(){return Math.min(...this.a)}}',
    'BLIND150-067': 'function subsets(a){let r=[[]];for(const x of a)r=r.concat(r.map(y=>[...y,x]));return r}',
  };
  it.each(Object.entries(javascriptSolutions))('executes %s through the JavaScript browser engine', async (id, source) => {
    const question = q250.find((entry) => entry.id === id);
    const strategy = createFunctionExecutionStrategy(resolvePracticeExecutionContract(question));
    const manager = { execute: async ({ source: harness }) => {
      const result = await executeJavaScriptSource({ source: harness });
      return { status: result.status, output: result.stdout, errors: result.stderr ? [result.stderr] : [], executionTimeMs: 1 };
    } };
    const execution = await strategy.execute({ compilerManager: manager, definition: { language: 'javascript', editor: { fileName: 'main.js' } }, source, signal: new AbortController().signal, instanceId: id });
    expect(execution).toMatchObject({ status: 'success', allPassed: true });
  });

  it('observes mutation rather than a misleading return value', async () => {
    const question = q250.find(({ id }) => id === 'BLIND150-138');
    const strategy = createFunctionExecutionStrategy(resolvePracticeExecutionContract(question));
    const manager = { execute: async ({ source }) => { const r = await executeJavaScriptSource({ source }); return { status: r.status, output: r.stdout, errors: r.stderr ? [r.stderr] : [], executionTimeMs: 1 }; } };
    const source = 'function setZeroes(matrix){ return [[0,2],[0,0]]; }';
    const execution = await strategy.execute({ compilerManager: manager, definition: { language: 'javascript', editor: { fileName: 'main.js' } }, source, signal: new AbortController().signal, instanceId: 'mutation' });
    expect(execution.allPassed).toBe(false);
  });

  it.each([
    ['zero-length prefix', 'function removeDuplicates(a){return 0}', [0], true],
    ['single-item prefix', 'function removeDuplicates(a){a[0]=5;return 1}', [1, 5], true],
    ['full-length prefix', 'function removeDuplicates(a){return a.length}', [4, 1, 1, 2, 7], true],
    ['correct prefix with arbitrary suffix', 'function removeDuplicates(a){a[0]=1;a[1]=2;a[2]=99;return 2}', [2, 1, 2], true],
    ['wrong returned length', 'function removeDuplicates(a){a[0]=1;a[1]=2;return 1}', [2, 1, 2], false],
    ['right length but wrong prefix', 'function removeDuplicates(a){a[0]=9;a[1]=2;return 2}', [2, 1, 2], false],
    ['correct return without mutation', 'function removeDuplicates(a){return 2}', [2, 1, 2], false],
    ['malformed return', 'function removeDuplicates(a){return "two"}', [2, 1, 2], false],
    ['out-of-range return', 'function removeDuplicates(a){return 99}', [2, 1, 2], false],
  ])('valid-prefix mutation: %s', async (_label, source, expected, passes) => {
    const question = q250.find(({ id }) => id === 'NC250-168');
    const fixture = { name: 'prefix-contract', arguments: [[1, 1, 2, 7]], expected };
    const contract = { ...resolvePracticeExecutionContract(question), fixtures: [fixture] };
    const manager = { execute: async ({ source: harness }) => { const r = await executeJavaScriptSource({ source: harness }); return { status: r.status, output: r.stdout, errors: r.stderr ? [r.stderr] : [], executionTimeMs: 1 }; } };
    const execution = await createFunctionExecutionStrategy(contract).execute({ compilerManager: manager, definition: { language: 'javascript', editor: { fileName: 'main.js' } }, source, signal: new AbortController().signal, instanceId: 'valid-prefix' });
    expect(execution.allPassed).toBe(passes);
  });

  it.each([
    ['BLIND150-034', 'class ListNode{constructor(val=0,next=null){this.val=val;this.next=next}} function reverseList(h){if(h)h.next=h;return h}'],
    ['BLIND150-045', 'class TreeNode{constructor(val=0,left=null,right=null){this.val=val;this.left=left;this.right=right}} function invertTree(r){if(r)r.left=r;return r}'],
    ['BLIND150-082', 'class GraphNode{constructor(val=0,neighbors=[]){this.val=val;this.neighbors=neighbors}} function cloneGraph(n){return n}'],
  ])('fails malformed or non-cloned %s output safely', async (id, source) => {
    const question = q250.find((entry) => entry.id === id);
    const contract = { ...resolvePracticeExecutionContract(question), fixtures: [question.publicTests[0]] };
    const manager = { execute: async ({ source: harness }) => { const r = await executeJavaScriptSource({ source: harness }); return { status: r.status, output: r.stdout, errors: r.stderr ? [r.stderr] : [], executionTimeMs: 1 }; } };
    const execution = await createFunctionExecutionStrategy(contract).execute({ compilerManager: manager, definition: { language: 'javascript', editor: { fileName: 'main.js' } }, source, signal: new AbortController().signal, instanceId: id });
    expect(execution.allPassed).toBe(false);
    expect(execution.functionResults[0].status).toBe('runtime_error');
  });
});
