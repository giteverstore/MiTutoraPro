import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ROLES } from '../../../shared/admin/adminAuthorization.js';
import { StudioListState, useStudioList } from '../src/content-studio/StudioListState.jsx';
import { SemanticBlockPreview } from '../src/content-studio/blocks/SemanticBlockPreview.jsx';
import { BlockCanvas } from '../src/content-studio/blocks/BlockCanvas.jsx';
import { DraftsPage } from '../src/publishing/PublishingPages.jsx';
import { adminContentRequest, loadAllPages } from '../src/publishing/publishingApi.js';

vi.mock('../src/publishing/publishingApi.js', () => ({
  adminContentRequest: vi.fn(), loadAllPages: vi.fn(),
  editorPath: (type, id) => type === 'PROJECT' ? `/content/projects/${id}/edit` : null,
  formatDate: (value) => value ?? '-',
}));

afterEach(cleanup);

function ListFixture({ load }) {
  const resource = useStudioList(load);
  return <StudioListState resource={resource} label="Projects" empty="No drafts yet."><div>Loaded {resource.items.length} items</div></StudioListState>;
}

describe('Admin list state', () => {
  it('never flashes empty before a pending read completes', async () => {
    let resolve;
    const load = vi.fn(() => new Promise((done) => { resolve = done; }));
    render(<ListFixture load={load} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading Projects');
    expect(screen.queryByText('No drafts yet.')).not.toBeInTheDocument();
    resolve([]);
    expect(await screen.findByText('No drafts yet.')).toBeInTheDocument();
  });
  it('renders data and a retryable error distinctly', async () => {
    const success = () => Promise.resolve([1]);
    const failure = () => Promise.reject(new Error('Network error'));
    const { rerender } = render(<ListFixture load={success} />);
    expect(await screen.findByText('Loaded 1 items')).toBeInTheDocument();
    rerender(<ListFixture load={failure} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
  });
});

describe('Shared semantic authoring preview', () => {
  it('renders heading, paragraph, code, warning, table, output, and compiler visually', () => {
    const blocks = [
      { type: 'heading', text: 'Heading' }, { type: 'paragraph', content: 'Paragraph' },
      { type: 'code', language: 'python', code: 'print(1)' }, { type: 'warning', title: 'Caution', content: 'Watch out' },
      { type: 'table', columns: ['Name'], rows: [['Ada']] }, { type: 'expected-output', expectedOutput: '42' },
      { type: 'compiler', language: 'python', starterCode: 'print(42)', expectedOutput: '42' },
    ];
    const { container } = render(<>{blocks.map((block, index) => <SemanticBlockPreview key={index} block={block} />)}</>);
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument();
    expect(screen.getByText('Paragraph')).toBeInTheDocument();
    expect(container.querySelector('pre code')).toHaveTextContent('print(1)');
    expect(container.querySelector('.content-callout.is-warning')).toHaveTextContent('Watch out');
    expect(screen.getByRole('table')).toHaveTextContent('Ada');
    expect(container.querySelectorAll('.content-output')).toHaveLength(2);
  });
  it('uses semantic code rendering for legacy Course/Practice/Challenge blocks inside editing chrome', () => {
    const { container } = render(<BlockCanvas blocks={[{ id: 'code-1', blockId: 'code-1', type: 'code', code: 'print(42)', language: 'python' }]} selectedBlockId="code-1" readOnly={false} language="python" dispatch={() => {}} renderPreview={() => <p>Plain summary</p>} />);
    expect(container.querySelector('.content-canvas-block-preview pre code')).toHaveTextContent('print(42)');
    expect(screen.queryByText('Plain summary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate block' })).toBeInTheDocument();
  });
});

describe('Draft deletion UI', () => {
  const draft = { contentId: 'project-1', contentType: 'PROJECT', title: 'Example Project', draftRevision: 2, updatedAt: '2026-10-10', updatedBy: 'editor' };
  beforeEach(() => {
    vi.clearAllMocks();
    loadAllPages.mockImplementation(async (resource) => resource === 'draft-summaries' ? [draft] : []);
    adminContentRequest.mockResolvedValue({ deleted: true });
  });
  it('requires confirmation and cancel makes no request', async () => {
    render(<DraftsPage role={ADMIN_ROLES.CONTENT_ADMIN} onNavigate={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete', exact: true }));
    expect(screen.getByRole('dialog', { name: 'Delete draft?' })).toHaveTextContent('Published versions are not affected');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(adminContentRequest).not.toHaveBeenCalled();
  });
  it('retains the draft on failure and removes it only after server success', async () => {
    render(<DraftsPage role={ADMIN_ROLES.CONTENT_ADMIN} onNavigate={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete', exact: true }));
    adminContentRequest.mockRejectedValueOnce(new Error('Conflict'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Conflict');
    expect(screen.getByRole('heading', { name: 'Example Project' })).toBeInTheDocument();
    loadAllPages.mockImplementation(async () => []);
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    await waitFor(() => expect(screen.queryByText('Example Project')).not.toBeInTheDocument());
    expect(adminContentRequest).toHaveBeenCalledWith('drafts/project-1', { method: 'DELETE', body: { contentType: 'PROJECT', expectedRevision: 2 } });
  });
  it('does not offer Delete to a reviewer', async () => {
    render(<DraftsPage role={ADMIN_ROLES.CONTENT_REVIEWER} onNavigate={() => {}} />);
    expect(await screen.findByText('Example Project')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete', exact: true })).not.toBeInTheDocument();
  });
});
