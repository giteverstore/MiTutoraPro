import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseAppRoute, routePath } from '../../src/routing/appRoutes';

vi.mock('../../src/auth/AuthService', () => ({ authService: { getIdToken: vi.fn(async () => 'token') } }));
vi.mock('../../src/compiler/CompilerProvider', () => ({ useCompilerManager: () => ({ execute:vi.fn() }) }));
vi.mock('../../src/components/MonacoCodeEditor', () => ({ default:({ value, onChange, editor }) => <textarea aria-label={editor.ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} /> }));
vi.mock('../../src/compiler/languages/supportedLanguages', () => ({ getSupportedCompilerLanguage:(id)=>({ id, label:id }), sortCompilerLanguageOptions:(items)=>items }));

let V2PracticeRepository, parseLearnerPractice, V2PilotPracticePage;
afterEach(cleanup);
beforeAll(async () => {
  ({ V2PracticeRepository, parseLearnerPractice } = await import('../../src/v2-pilot/V2PracticeRepository'));
  ({ V2PilotPracticePage } = await import('../../src/v2-pilot/V2PilotPracticePage'));
});

const identity = { namespace:'v2', contentType:'practice', contentId:'practice-a', publicationVersion:2 };
const practice = {
  identity, questionId:'practice-a', title:'Sum Two Integers', summary:'Add values.', difficulty:'easy', topics:['math'], tags:['pilot'], estimatedMinutes:5,
  languages:{ supported:[{ id:'python', displayName:'Python' }, { id:'javascript', displayName:'JavaScript' }], defaultLanguageId:'python' },
  starterCode:[{ languageId:'python', code:'def add(a, b):\n    pass' }, { languageId:'javascript', code:'function add(a, b) {}' }],
  examples:[{ id:'example-1', input:{ value:'1, 2' }, output:{ value:'3' }, explanation:'Adds both integers.' }], constraints:['Integers only.'], hints:[{ id:'hint-1', text:'Use +.' }],
  instructions:[{ id:'block-1', type:'richText', data:{ document:{ type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text:'Return their sum.' }] }] } } }],
  execution:{ mode:'function', adapterFamily:'return-value', entrypoint:'add', arguments:[{ name:'a', type:'integer' }, { name:'b', type:'integer' }], result:{ type:'integer' }, resultSource:{ kind:'return-value' } },
  publicTests:[{ id:'test-1', label:'positive values', arguments:[{ value:1 }, { value:2 }], expectedResult:{ value:3 }, comparison:{ kind:'json-equivalent' } }], executionAssurance:'browser-public-tests', runSemantics:'execute-and-evaluate-all-public-tests', assets:[],
};
const envelope = { namespace:'v2', contentType:'practice', contentId:'practice-a', publicationVersion:2, practice, integrity:{ artifactHash:'sha256:a', documentHash:'sha256:b', assetManifestHash:'sha256:c', verified:true }, warnings:[] };

describe('V2 Practice pilot', () => {
  it('parses active and exact preview routes', () => {
    expect(parseAppRoute('/pilot/v2/practice/practice-a')).toMatchObject({ kind:'v2-pilot-practice', contentId:'practice-a' });
    const exact = parseAppRoute('/pilot/v2/practice/practice-a/versions/2');
    expect(exact).toMatchObject({ publicationVersion:2 }); expect(routePath(exact)).toBe('/pilot/v2/practice/practice-a/versions/2');
  });
  it('loads active and exact versions and validates identity', async () => {
    const fetchImpl = vi.fn(async () => ({ ok:true, status:200, headers:new Headers(), json:async () => ({ ok:true, data:envelope }) }));
    const repository = new V2PracticeRepository({ tokenProvider:async () => 'token', fetchImpl });
    await expect(repository.load({ contentId:'practice-a', publicationVersion:2 })).resolves.toMatchObject({ identity:{ publicationVersion:2 } });
    expect(fetchImpl).toHaveBeenCalledWith('/api/v2-pilot/practice/practice-a/versions/2', expect.objectContaining({ headers:expect.objectContaining({ Authorization:'Bearer token' }) }));
  });
  it('rejects unsafe DTO serialization', () => {
    expect(() => parseLearnerPractice({ ...practice, referenceSolutions:[{ code:'secret' }] }, identity)).toThrow(/safety/i);
  });
  it('renders an editable local workspace and runs without persistence actions', async () => {
    const repository = { load:vi.fn(async () => envelope) };
    const executionClient = vi.fn(async ({ language, source }) => ({ status:'passed', message:'1/1 public tests passed', tests:[{ id:'test-1', label:`${language} values`, status:'passed', actual:3, expected:3 }], source }));
    const { container }=render(<V2PilotPracticePage contentId="practice-a" publicationVersion={2} repository={repository} onExit={() => {}} executionClient={executionClient} />);
    expect(await screen.findByRole('heading', { name:'Sum Two Integers' })).toBeInTheDocument();
    expect(container.querySelector('.practice-immersive-workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('V2 Practice compiler')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name:'Output' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name:'Expected' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name:'Tests' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name:'Errors' })).toBeInTheDocument();
    expect(screen.getByText('Return their sum.')).toBeInTheDocument();
    expect(screen.getByLabelText('python Practice editor').value).toContain('def add');
    fireEvent.click(screen.getByRole('button', { name:'Compiler language' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name:'JavaScript' }));
    await waitFor(() => expect(screen.getByLabelText('javascript Practice editor').value).toContain('function add'));
    fireEvent.change(screen.getByLabelText('javascript Practice editor'), { target:{ value:'function add(a, b) { return a + b; }' } });
    fireEvent.click(screen.getByRole('button', { name:'Run code' }));
    await waitFor(() => expect(executionClient).toHaveBeenCalledWith(expect.objectContaining({ language:'javascript', source:'function add(a, b) { return a + b; }' })));
    expect(await screen.findByText(/Test 1\s+Passed/)).toBeInTheDocument();
    expect(screen.queryByText(/reference solution/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name:/submit|verify/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name:/check output/i })).not.toBeInTheDocument();
  });
  it('allows another Run after failure and error without making persistence requests', async () => {
    const repository = { load:vi.fn(async () => envelope) };
    const executionClient=vi.fn()
      .mockResolvedValueOnce({ status:'failed', message:'0/1 public tests passed', tests:[{ id:'test-1', label:'positive values', status:'failed', expected:3, actual:0 }] })
      .mockResolvedValueOnce({ status:'error', message:'SyntaxError', tests:[{ id:'test-1', label:'positive values', status:'error', errorKind:'compile', message:'SyntaxError' }] });
    render(<V2PilotPracticePage contentId="practice-a" publicationVersion={2} repository={repository} onExit={() => {}} executionClient={executionClient} />);
    const run=await screen.findByRole('button',{ name:'Run code' });
    fireEvent.click(run);
    expect(await screen.findByText(/Test 1\s+Failed/)).toBeInTheDocument();
    fireEvent.click(run);
    await waitFor(()=>expect(executionClient).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('SyntaxError')).toBeInTheDocument();
    expect(repository.load).toHaveBeenCalledTimes(1);
  });
});
