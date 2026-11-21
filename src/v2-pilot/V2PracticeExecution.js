import { createPracticeFunctionHarness, parseFunctionHarnessResult } from '../compiler/function-mode/containsDuplicateHarness';
import { compareFunctionResult } from '../compiler/function-mode/functionResultComparison';

const semanticPolicies = Object.freeze({
  'two-sum-pair':'two-sum', 'unordered-nested':'unordered-nested', 'triplet-set':'triplets', 'combination-set':'combination-set',
  'quadruplet-set':'quadruplet-set', 'ordered-integer-rows':'ordered-int-rows', 'coordinate-set':'coordinate-set', 'interval-set':'interval-set',
  'permutation-set':'permutation-set', 'ordered-string-rows':'ordered-string-rows', 'anagram-groups':'anagrams', 'unordered-strings':'unordered-strings',
  'unordered-unique-integers':'unordered-unique', 'top-k':'top-k', 'closest-points':'closest-points', 'longest-palindrome':'longest-palindrome',
  'finite-ratios':'finite-ratios', 'account-set':'account-set', 'course-order':'course-order', 'alien-order':'alien-order', 'edge-groups':'edge-groups',
  'graph-adjacency':'graph-adjacency', 'bst-values':'bst-values', 'quad-tree':'quad-tree', 'reorganized-string':'reorganized', 'happy-string':'happy', 'condition-matrix':'condition-matrix',
});

function canonical(value) { if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`; return JSON.stringify(value); }
export function compareV2PracticeResult(comparison, actual, expected, fixture = {}) {
  if (comparison.kind === 'exact-text') { const normalize=(value)=>String(value??'').replace(/\r\n?/g,'\n').replace(/\n$/,''); const left=normalize(actual),right=normalize(expected); return comparison.case==='insensitive'?left.toLocaleLowerCase('en-US')===right.toLocaleLowerCase('en-US'):left===right; }
  if (comparison.kind === 'trimmed-text') { const left=String(actual??'').replace(/\r\n?/g,'\n').replace(/\n$/,'').trim(),right=String(expected??'').replace(/\r\n?/g,'\n').replace(/\n$/,'').trim(); return comparison.case==='insensitive'?left.toLocaleLowerCase('en-US')===right.toLocaleLowerCase('en-US'):left===right; }
  if (comparison.kind === 'json-equivalent') return canonical(actual) === canonical(expected);
  if (comparison.kind === 'numeric-tolerance') return Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual-expected)<=comparison.tolerance;
  if (comparison.kind === 'semantic') { const policy=semanticPolicies[comparison.validatorId]; if(!policy) throw new Error(`Unsupported semantic validator: ${comparison.validatorId}`); return compareFunctionResult({policy,actual,expected,fixture}); }
  throw new Error(`Unsupported Practice comparator: ${comparison.kind}`);
}

export function createV2FunctionContract(practice) {
  const execution=practice.execution;
  if(execution?.mode!=='function') throw new Error('V2 function execution requires a function contract.');
  const adapter={ 'return-value':'plain-return', 'mutated-argument':'mutation', 'valid-prefix-mutation':'valid-prefix-mutation', 'linked-structure':'linked-list', 'tree-structure':'tree', 'graph-structure':'graph', 'stateful-object':'stateful-object', 'semantic-collection':'semantic-collection', 'quad-tree-structure':'quad-tree' }[execution.adapterFamily];
  if(!adapter) throw new Error(`Unsupported adapter family: ${execution.adapterFamily}`);
  return Object.freeze({ version:'practice-function-v1', questionId:practice.questionId, executionMode:'function', adapter, callable:{name:execution.entrypoint,className:'Solution'}, arguments:execution.arguments.map((argument,index)=>({index,type:argument.type})), callableArgumentIndexes:execution.arguments.map((_,index)=>index), nodeReferenceArguments:{}, returns:{type:execution.result.type}, mutation:{target:execution.resultSource.kind==='mutated-argument'?execution.resultSource.argumentIndex:null}, resultSource:execution.resultSource, identityPolicy:'structure-only', includeRandom:false, stateful:null, serialization:{format:'json',bounded:false}, validation:{type:'exact',requireDistinctRoot:false}, fixtures:[] });
}

function failure(error, execution) { const message=error?.message||execution?.errors?.join('\n')||'Execution failed.'; const kind=execution?.status==='error'&&/compile|syntax|diagnostic|parse error/i.test(message)?'compile':'runtime'; return {status:'error',errorKind:error?.code==='FUNCTION_SERIALIZATION_ERROR'?'contract':kind,message}; }
export async function executeV2Practice({ compilerManager, practice, language, source, signal = new AbortController().signal, instanceId='v2-practice' }) {
  if(practice.execution?.mode==='stateful') return {status:'error',errorKind:'contract',message:'Stateful Practice execution is not enabled in P5.',tests:[]};
  if(practice.execution?.mode==='stdout') {
    const tests=[]; for(const test of practice.publicTests){ try{const run=await compilerManager.execute({language,source,stdin:test.stdin,signal,instanceId:`${instanceId}-${test.id}`,timeoutMs:15_000});if(run.status!=='success'){tests.push({id:test.id,label:test.label,...failure(null,run)});continue;}const passed=compareV2PracticeResult(test.comparison,run.output,test.expectedOutput,test);tests.push({id:test.id,label:test.label,status:passed?'passed':'failed',passed,expected:test.expectedOutput,actual:run.output});}catch(error){tests.push({id:test.id,label:test.label,...failure(error)});} }
    return aggregate(tests);
  }
  const contract=createV2FunctionContract(practice),tests=[];
  for(const test of practice.publicTests){const fixture={name:test.id,arguments:test.arguments.map(({value})=>value),expected:test.expectedResult.value};try{const harness=createPracticeFunctionHarness({language,source,fixture,contract}),run=await compilerManager.execute({language,source:harness,filename:language==='java'?'Solution.java':undefined,signal,instanceId:`${instanceId}-${test.id}`,timeoutMs:15_000});if(run.status!=='success'){tests.push({id:test.id,label:test.label,...failure(null,run)});continue;}const actual=parseFunctionHarnessResult(run.output),passed=compareV2PracticeResult(test.comparison,actual,fixture.expected,fixture);tests.push({id:test.id,label:test.label,status:passed?'passed':'failed',passed,expected:fixture.expected,actual});}catch(error){tests.push({id:test.id,label:test.label,...failure(error)});} }
  return aggregate(tests);
}
function aggregate(tests){if(tests.some(({status})=>status==='error'))return{status:'error',tests,message:tests.find(({status})=>status==='error').message};const passed=tests.every(({status})=>status==='passed');return{status:passed?'passed':'failed',tests,message:`${tests.filter(({status})=>status==='passed').length}/${tests.length} public tests passed`};}
