import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockRenderer } from '../../src/components/BlockRenderer.jsx';
import { ProjectGuideRenderer } from '../../src/projects/components/ProjectGuideRenderer.jsx';

afterEach(cleanup);

describe('shared learner content tables', () => {
  it('renders Course lesson headers and cells with semantic, scrollable shared styling', () => {
    const columns = [{ key: 'concept', header: 'Concept' }, { key: 'meaning', header: 'Meaning' }];
    const rows = [{ concept: 'Console output', meaning: 'Words shown by the program.' }];
    const { container } = render(<BlockRenderer lesson={{ blocks: [{ id: 'program-concepts', type: 'table', caption: 'Program concepts', columns, rows }] }} />);
    const wrapper = container.querySelector('.content-table-scroll.table-card');
    expect(wrapper).toHaveAttribute('tabindex', '0');
    expect(wrapper).toHaveClass('is-label-pair');
    const table = within(wrapper).getByRole('table', { name: 'Program concepts' });
    expect(table.querySelectorAll('thead th[scope="col"]')).toHaveLength(2);
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(within(table).getByText('Console output')).toBeTruthy();
    expect(columns).toEqual([{ key: 'concept', header: 'Concept' }, { key: 'meaning', header: 'Meaning' }]);
    expect(rows).toEqual([{ concept: 'Console output', meaning: 'Words shown by the program.' }]);
  });

  it('renders Project Guide two-column tables with the same semantic wrapper and no content changes', () => {
    const block = { type: 'table', columns: ['Skill', 'How Bingo uses it'], rows: [['Console output', 'Shows the result of each draw.']] };
    const { container } = render(<ProjectGuideRenderer blocks={[block]} />);
    const wrapper = container.querySelector('.project-structured-guide > .content-table-scroll.is-label-pair');
    expect(wrapper).toHaveAttribute('tabindex', '0');
    expect(within(wrapper).getByRole('columnheader', { name: 'Skill' })).toBeTruthy();
    expect(within(wrapper).getByRole('cell', { name: 'Console output' })).toBeTruthy();
    expect(block.rows[0]).toEqual(['Console output', 'Shows the result of each draw.']);
  });

  it('keeps three-column tables naturally sized rather than forcing label-pair proportions', () => {
    const { container } = render(<ProjectGuideRenderer blocks={[{ type: 'table', columns: ['Language', 'Command', 'Result'], rows: [['Python', 'print(1)', '1']] }]} />);
    const wrapper = container.querySelector('.content-table-scroll');
    expect(wrapper).not.toHaveClass('is-label-pair');
    expect(wrapper.querySelectorAll('thead th')).toHaveLength(3);
    expect(wrapper.querySelectorAll('tbody td')).toHaveLength(3);
  });

  it('renders semantic Project notes with the canonical callout treatment', () => {
    const { container } = render(<ProjectGuideRenderer blocks={[{ type: 'note', text: 'Keep each Bingo value unique.' }]} />);
    const note = container.querySelector('.project-guide-note');
    expect(note).toHaveTextContent('Note: Keep each Bingo value unique.');
    expect(note.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(note.querySelector('strong')).toHaveTextContent('Note:');
  });
});
