import { describe, expect, it, vi } from 'vitest';
import { compareV2PracticeResult, createV2FunctionContract, executeV2Practice } from '../../src/v2-pilot/V2PracticeExecution';

const practice = {
  questionId:'practice-a', identity:{ contentId:'practice-a', publicationVersion:2 },
  execution:{ mode:'function', adapterFamily:'return-value', entrypoint:'add', arguments:[{ name:'a', type:'integer' }, { name:'b', type:'integer' }], result:{ type:'integer' }, resultSource:{ kind:'return-value' } },
  publicTests:[
    { id:'one', label:'one', arguments:[{ value:1 }, { value:2 }], expectedResult:{ value:3 }, comparison:{ kind:'json-equivalent' } },
    { id:'two', label:'two', arguments:[{ value:-2 }, { value:5 }], expectedResult:{ value:3 }, comparison:{ kind:'json-equivalent' } },
  ],
};

describe('V2 Practice browser execution', () => {
  it('maps the published learner contract without reference solutions', () => {
    expect(createV2FunctionContract(practice)).toMatchObject({ adapter:'plain-return', callable:{ name:'add' }, returns:{ type:'integer' } });
    expect(createV2FunctionContract(practice)).not.toHaveProperty('referenceSolutions');
  });
  it('implements the bounded comparison contract', () => {
    expect(compareV2PracticeResult({ kind:'exact-text', case:'insensitive' }, 'YES\n', 'yes')).toBe(true);
    expect(compareV2PracticeResult({ kind:'trimmed-text', case:'sensitive' }, '  ok \n', 'ok')).toBe(true);
    expect(compareV2PracticeResult({ kind:'json-equivalent' }, { b:2, a:[1] }, { a:[1], b:2 })).toBe(true);
    expect(compareV2PracticeResult({ kind:'numeric-tolerance', tolerance:0.01 }, 1.005, 1)).toBe(true);
    expect(() => compareV2PracticeResult({ kind:'semantic', validatorId:'not-approved' }, [], [])).toThrow(/Unsupported semantic validator/);
  });
  it('uses only the closed semantic registry for representative families', () => {
    expect(compareV2PracticeResult({ kind:'semantic', validatorId:'unordered-unique-integers' }, [3,1,2], [1,2,3], {})).toBe(true);
    expect(compareV2PracticeResult({ kind:'semantic', validatorId:'two-sum-pair' }, [0,2], [1,0], { arguments:[[2,7,11],13] })).toBe(true);
    expect(compareV2PracticeResult({ kind:'semantic', validatorId:'ordered-integer-rows' }, [[1,2],[3,4]], [[3,4],[1,2]], {})).toBe(true);
  });
  it('executes every public test and aggregates pass, fail, and error', async () => {
    const marker=(value)=>`__YCODERS_FUNCTION_RESULT__${JSON.stringify({ value })}`;
    const compilerManager={ execute:vi.fn().mockResolvedValue({ status:'success', output:marker(3), errors:[] }) };
    await expect(executeV2Practice({ compilerManager, practice, language:'javascript', source:'function add(a,b){return a+b;}' })).resolves.toMatchObject({ status:'passed', message:'2/2 public tests passed' });
    compilerManager.execute.mockResolvedValueOnce({ status:'success', output:marker(99), errors:[] }).mockResolvedValueOnce({ status:'success', output:marker(3), errors:[] });
    await expect(executeV2Practice({ compilerManager, practice, language:'javascript', source:'function add(a,b){return 99;}' })).resolves.toMatchObject({ status:'failed', tests:[{ status:'failed' }, { status:'passed' }] });
    compilerManager.execute.mockResolvedValueOnce({ status:'error', errors:['SyntaxError: unexpected token'] }).mockResolvedValueOnce({ status:'success', output:marker(3), errors:[] });
    const errored=await executeV2Practice({ compilerManager, practice, language:'javascript', source:'broken' });
    expect(errored).toMatchObject({ status:'error', tests:[{ status:'error', errorKind:'compile' }, { status:'passed' }] });
    expect(compilerManager.execute).toHaveBeenCalledTimes(6);
  });
  it('explicitly defers stateful execution in P5', async () => {
    await expect(executeV2Practice({ compilerManager:{}, practice:{ ...practice, execution:{ mode:'stateful' } }, language:'javascript', source:'' })).resolves.toMatchObject({ status:'error', errorKind:'contract' });
  });
  it('runs stdout fixtures with exact P2 newline and whitespace semantics', async () => {
    const compilerManager={ execute:vi.fn()
      .mockResolvedValueOnce({ status:'success', output:'a  b\r\n', errors:[] })
      .mockResolvedValueOnce({ status:'success', output:'  complete  \n', errors:[] }) };
    const stdoutPractice={ ...practice, execution:{ mode:'stdout', serialization:'utf8-text-v1', sourceShape:'program' }, publicTests:[
      { id:'exact', label:'exact', stdin:'first', expectedOutput:'a  b\n', comparison:{ kind:'exact-text', case:'sensitive', newline:'normalize-crlf' } },
      { id:'trimmed', label:'trimmed', stdin:'second', expectedOutput:'complete', comparison:{ kind:'trimmed-text', case:'sensitive', newline:'normalize-crlf' } },
    ] };
    await expect(executeV2Practice({ compilerManager, practice:stdoutPractice, language:'javascript', source:'program' })).resolves.toMatchObject({ status:'passed', tests:[{ status:'passed' },{ status:'passed' }] });
    expect(compilerManager.execute.mock.calls.map(([request])=>request.stdin)).toEqual(['first','second']);
  });
  it('generates each historical version from that version embedded contract', async () => {
    const marker=`__YCODERS_FUNCTION_RESULT__${JSON.stringify({ value:3 })}`;
    const compilerManager={ execute:vi.fn().mockResolvedValue({ status:'success', output:marker, errors:[] }) };
    const v1={ ...practice, identity:{ contentId:'practice-a', publicationVersion:1 }, execution:{ ...practice.execution, entrypoint:'addV1' }, publicTests:[practice.publicTests[0]] };
    const v2={ ...practice, identity:{ contentId:'practice-a', publicationVersion:2 }, execution:{ ...practice.execution, entrypoint:'addV2' }, publicTests:[practice.publicTests[0]] };
    await executeV2Practice({ compilerManager, practice:v1, language:'javascript', source:'function addV1(a,b){return a+b;}' });
    await executeV2Practice({ compilerManager, practice:v2, language:'javascript', source:'function addV2(a,b){return a+b;}' });
    expect(compilerManager.execute.mock.calls[0][0].source).toContain('v=addV1(...a)');
    expect(compilerManager.execute.mock.calls[1][0].source).toContain('v=addV2(...a)');
  });
});
