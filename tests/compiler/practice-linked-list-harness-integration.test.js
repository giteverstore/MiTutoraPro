import { describe, expect, it } from 'vitest';
import q250 from '../../src/practice/data/q250PracticeQuestions.json';
import { resolveLinkedListCandidateExecutionContract, resolveStructuralCandidateExecutionContract } from '../../src/compiler/function-mode/functionExecutionContract';
import { createPracticeFunctionHarness } from '../../src/compiler/function-mode/containsDuplicateHarness';
import { createFunctionExecutionStrategy } from '../../src/compiler/function-mode/functionExecutionStrategy';
import { executeJavaScriptSource } from '../../src/compiler/runtimes/javascript/javascriptExecution';

const ids = ['BLIND150-035', 'BLIND150-036', 'BLIND150-037', 'BLIND150-038', 'BLIND150-039', 'BLIND150-040', 'BLIND150-043', 'BLIND150-044', 'NC250-190', 'NC250-245'];
const languages = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'r'];
const base = 'class ListNode{constructor(val=0,next=null){this.val=val;this.next=next}}\n';
const references = {
  'BLIND150-035': `${base}function mergeTwoLists(a,b){const d=new ListNode(),t=d;let p=t;while(a&&b){if(a.val<=b.val){p.next=a;a=a.next}else{p.next=b;b=b.next}p=p.next}p.next=a||b;return d.next}`,
  'BLIND150-036': `${base}function hasCycle(h){let a=h,b=h;while(b&&b.next){a=a.next;b=b.next.next;if(a===b)return true}return false}`,
  'BLIND150-037': `${base}function reorderList(h){if(!h)return;let s=h,f=h;while(f&&f.next){s=s.next;f=f.next.next}let p=null,c=s;while(c){const n=c.next;c.next=p;p=c;c=n}let a=h,b=p;while(b&&b.next){const x=a.next,y=b.next;a.next=b;b.next=x;a=x;b=y}}`,
  'BLIND150-038': `${base}function removeNthFromEnd(h,n){const d=new ListNode(0,h);let a=d,b=d;while(n--)b=b.next;while(b.next){a=a.next;b=b.next}a.next=a.next.next;return d.next}`,
  'BLIND150-039': `class RandomNode{constructor(val=0){this.val=val;this.next=null;this.random=null}} function copyRandomList(h){if(!h)return null;const m=new Map();for(let n=h;n;n=n.next)m.set(n,new RandomNode(n.val));for(let n=h;n;n=n.next){m.get(n).next=m.get(n.next)||null;m.get(n).random=m.get(n.random)||null}return m.get(h)}`,
  'BLIND150-040': `${base}function addTwoNumbers(a,b){const d=new ListNode();let p=d,c=0;while(a||b||c){const s=(a?a.val:0)+(b?b.val:0)+c;c=Math.floor(s/10);p.next=new ListNode(s%10);p=p.next;a=a&&a.next;b=b&&b.next}return d.next}`,
  'BLIND150-043': `${base}function mergeKLists(ls){let a=[];for(let h of ls)for(;h;h=h.next)a.push(h);a.sort((x,y)=>x.val-y.val);for(let i=0;i<a.length;i++)a[i].next=a[i+1]||null;return a[0]||null}`,
  'BLIND150-044': `${base}function reverseKGroup(h,k){const d=new ListNode(0,h);let g=d;for(;;){let e=g;for(let i=0;i<k&&e;i++)e=e.next;if(!e)return d.next;const stop=e.next;let p=stop,c=g.next;while(c!==stop){const n=c.next;c.next=p;p=c;c=n}const t=g.next;g.next=e;g=t}}`,
  'NC250-190': `${base}function reverseBetween(h,l,r){const d=new ListNode(0,h);let p=d;for(let i=1;i<l;i++)p=p.next;let c=p.next;for(let i=l;i<r;i++){const n=c.next;c.next=n.next;n.next=p.next;p.next=n}return d.next}`,
  'NC250-245': `${base}function insertGreatestCommonDivisors(h){const gcd=(a,b)=>b?gcd(b,a%b):a;for(let n=h;n&&n.next;n=n.next.next)n.next=new ListNode(gcd(n.val,n.next.val),n.next);return h}`,
};

describe('generic linked-list generated harness integration', () => {
  it.each(ids.flatMap((id) => languages.map((language) => [id, language])))('%s generates a %s harness from candidate metadata', (id, language) => {
    const question = q250.find((entry) => entry.id === id);
    const contract = resolveLinkedListCandidateExecutionContract(question);
    const harness = createPracticeFunctionHarness({ language, source: question.starterTemplates[language], fixture: question.publicTests[0], contract });
    expect(harness).toContain(contract.callable.name);
    expect(harness).toContain('__YCODERS_FUNCTION_RESULT__');
  });

  it.each(ids)('%s passes all public fixtures in the real JavaScript runtime', async (id) => {
    const question = q250.find((entry) => entry.id === id);
    const contract = resolveLinkedListCandidateExecutionContract(question);
    const manager = { execute: async ({ source }) => { const result = await executeJavaScriptSource({ source }); return { status: result.status, output: result.stdout, errors: result.stderr ? [result.stderr] : [], executionTimeMs: 1 }; } };
    const result = await createFunctionExecutionStrategy(contract).execute({ compilerManager: manager, definition: { language: 'javascript', editor: { fileName: 'main.js' } }, source: references[id], signal: new AbortController().signal, instanceId: id });
    expect(result.functionResults).toHaveLength(3);
    expect(result).toMatchObject({ status: 'success', allPassed: true });
  });
});

describe('generic structural generated harness integration', () => {
  const treeSource = `class TreeNode{constructor(val=0,left=null,right=null){this.val=val;this.left=left;this.right=right}}
function maxDepth(root){return root?1+Math.max(maxDepth(root.left),maxDepth(root.right)):0}
function isSameTree(a,b){return !a||!b?a===b:a.val===b.val&&isSameTree(a.left,b.left)&&isSameTree(a.right,b.right)}
function buildTreeFromTraversals(pre,inorder){const at=new Map(inorder.map((value,index)=>[value,index]));let i=0;function build(left,right){if(left>right)return null;const root=new TreeNode(pre[i++]),mid=at.get(root.val);root.left=build(left,mid-1);root.right=build(mid+1,right);return root}return build(0,inorder.length-1)}`;

  it.each(['BLIND150-046', 'BLIND150-049', 'BLIND150-057'])('%s constructs real tree arguments and a bounded result serializer', (id) => {
    const question = q250.find((entry) => entry.id === id);
    const contract = resolveStructuralCandidateExecutionContract(question);
    const harness = createPracticeFunctionHarness({ language: 'javascript', source: treeSource, fixture: question.publicTests[0], contract });
    expect(harness).toContain('function tree(values)');
    if (id === 'BLIND150-057') expect(harness).toContain('Cyclic or shared tree output');
    expect(harness).toContain(contract.callable.name);
  });

  it.each(['BLIND150-046', 'BLIND150-049', 'BLIND150-057'])('%s passes all public fixtures in the real JavaScript runtime', async (id) => {
    const question = q250.find((entry) => entry.id === id);
    const contract = resolveStructuralCandidateExecutionContract(question);
    const manager = { execute: async ({ source }) => { const result = await executeJavaScriptSource({ source }); return { status: result.status, output: result.stdout, errors: result.stderr ? [result.stderr] : [], executionTimeMs: 1 }; } };
    const result = await createFunctionExecutionStrategy(contract).execute({ compilerManager: manager, definition: { language: 'javascript', editor: { fileName: 'main.js' } }, source: treeSource, signal: new AbortController().signal, instanceId: id });
    expect(result.functionResults).toHaveLength(3);
    expect(result).toMatchObject({ status: 'success', allPassed: true });
  });

  it('passes exact fixture nodes and rejects a value-equivalent cloned LCA result', async () => {
    const question = q250.find((entry) => entry.id === 'BLIND150-051');
    const contract = resolveStructuralCandidateExecutionContract(question);
    const manager = { execute: async ({ source }) => { const result = await executeJavaScriptSource({ source }); return { status: result.status, output: result.stdout, errors: result.stderr ? [result.stderr] : [], executionTimeMs: 1 }; } };
    const correct = `${treeSource}\nfunction lowestCommonAncestor(root,p,q){while(root){if(p.val<root.val&&q.val<root.val)root=root.left;else if(p.val>root.val&&q.val>root.val)root=root.right;else return root}return null}`;
    const cloned = `${treeSource}\nfunction lowestCommonAncestor(root,p,q){return new TreeNode(root.val)}`;
    const execute = (source) => createFunctionExecutionStrategy(contract).execute({ compilerManager: manager, definition: { language: 'javascript', editor: { fileName: 'main.js' } }, source, signal: new AbortController().signal, instanceId: 'tree-node-identity' });
    await expect(execute(correct)).resolves.toMatchObject({ status: 'success', allPassed: true });
    const invalid = await execute(cloned);
    expect(invalid.allPassed).toBe(false);
    expect(invalid.functionResults.every(({ status }) => status === 'runtime_error')).toBe(true);
  });

  it('generates bounded quad-tree validation instead of treating nodes as value arrays', () => {
    const question = q250.find((entry) => entry.id === 'NC250-198');
    const contract = resolveStructuralCandidateExecutionContract(question);
    const harness = createPracticeFunctionHarness({ language: 'javascript', source: question.starterTemplates.javascript, fixture: question.publicTests[0], contract });
    expect(harness).toContain('Cyclic or shared quad-tree output');
    expect(harness).toContain('Quad-tree internal node is malformed');
    expect(harness).toContain('node.topLeft');
  });
});
