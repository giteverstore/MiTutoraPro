import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parseAppRoute, routePath } from '../../src/routing/appRoutes';

vi.mock('../../src/auth/AuthService', () => ({ authService: { getIdToken: vi.fn(async () => 'token') } }));

let V2PracticeRepository, parseLearnerPractice, V2PilotPracticePage;
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
  execution:{ mode:'function' }, publicTests:[{ id:'test-1', label:'positive values', comparison:{ kind:'json-equivalent' } }], executionAssurance:'browser-public-tests', runSemantics:'execute-and-evaluate-all-public-tests', assets:[],
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
  it('renders safe content and switches starter language locally without persistence actions', async () => {
    const repository = { load:vi.fn(async () => envelope) };
    render(<V2PilotPracticePage contentId="practice-a" publicationVersion={2} repository={repository} onExit={() => {}} />);
    expect(await screen.findByRole('heading', { name:'Sum Two Integers' })).toBeInTheDocument();
    expect(screen.getByText('Return their sum.')).toBeInTheDocument();
    expect(screen.getByTestId('practice-starter-code')).toHaveTextContent('def add');
    fireEvent.change(screen.getByLabelText('Language'), { target:{ value:'javascript' } });
    await waitFor(() => expect(screen.getByTestId('practice-starter-code')).toHaveTextContent('function add'));
    expect(screen.queryByText(/reference solution/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name:/run|submit|verify/i })).not.toBeInTheDocument();
  });
});
