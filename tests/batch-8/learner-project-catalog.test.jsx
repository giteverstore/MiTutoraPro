import { readFileSync, statSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { learnerProjectCatalog } from '../../src/projects/presentation/learnerProjectCatalog';
import { ProjectFoundationCard } from '../../src/projects/components/ProjectFoundationCard';
import { filterProjects, DEFAULT_PROJECT_FILTERS } from '../../src/projects/pages/ProjectsPage';

afterEach(cleanup);

const bingo = {
  id: 'bingo', title: 'Bingo', supportedLanguages: ['python'], category: 'Games',
  difficulty: 'Easy', checkpoints: [{ id: 'first' }], estimatedMinutes: 45,
};

describe('learner Project catalog presentation', () => {
  it('shows only the approved cards in product order without changing canonical records', () => {
    const bundled = projectCatalog.getProjects();
    const cards = learnerProjectCatalog(bundled, [bingo, { ...bingo, id: 'other-published' }]);
    expect(cards.map(({ title }) => title)).toEqual([
      'Bingo', 'Simple Calculator', 'Blackjack', 'Hangman', 'Stone Paper Scissors', 'Currency Converter',
    ]);
    expect(filterProjects(cards, DEFAULT_PROJECT_FILTERS)).toEqual(cards);
    expect(bundled.some(({ id }) => id === 'number-guessing-game')).toBe(true);
    expect(cards.some(({ id }) => id === 'number-guessing-game' || id === 'other-published')).toBe(false);
    expect(cards.find(({ id }) => id === 'simple-calculator').comingSoon).toBeUndefined();
  });

  it('maps six exact artworks to shipped files with no initial fallback', () => {
    const cards = learnerProjectCatalog(projectCatalog.getProjects(), [bingo]);
    for (const card of cards) {
      expect(card.artwork).toBe(`/assets/projects/${card.id}.png`);
      expect(statSync(`public${card.artwork}`).size).toBeGreaterThan(1000);
    }
    expect(readFileSync('src/styles/pages/projects.css', 'utf8')).toMatch(/\.project-card-artwork img\s*\{[^}]*object-fit:\s*contain/s);
  });

  it('keeps upcoming cards inert and progress-free while Bingo remains keyboard navigable', () => {
    const cards = learnerProjectCatalog(projectCatalog.getProjects(), [bingo]);
    const onOpen = vi.fn();
    const { container } = render(<div>{cards.map((card) => <ProjectFoundationCard key={card.id} project={card} progress={card.comingSoon ? null : { status: 'not-started', completedCheckpoints: [] }} onOpen={onOpen} />)}</div>);
    expect(container.querySelectorAll('.project-card')).toHaveLength(6);
    expect(container.querySelectorAll('.project-card.is-coming-soon')).toHaveLength(4);
    expect(container.querySelectorAll('.project-card.is-coming-soon .project-card-artwork img')).toHaveLength(4);
    expect(container.querySelectorAll('.project-card.is-coming-soon .content-type-badge--project')).toHaveLength(4);
    expect(container.querySelectorAll('.project-card.is-coming-soon .library-course-progress')).toHaveLength(0);
    expect(container.querySelectorAll('.project-card.is-coming-soon .project-card-progress')).toHaveLength(0);
    expect(container.querySelectorAll('.project-card.is-coming-soon .project-card-action')).toHaveLength(0);
    for (const card of container.querySelectorAll('.project-card.is-coming-soon')) {
      expect(card).not.toHaveAttribute('role', 'link');
      expect(card).not.toHaveAttribute('tabindex');
      expect(card).toHaveTextContent('Coming Soon');
      fireEvent.click(card);
      fireEvent.keyDown(card, { key: 'Enter' });
    }
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('link', { name: /Bingo/ }), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith(cards[0]);
    expect(container.querySelectorAll('.project-card-artwork.is-empty')).toHaveLength(0);
  });
});
