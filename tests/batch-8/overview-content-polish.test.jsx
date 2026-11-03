import { readFileSync } from 'node:fs';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { ProjectFoundationDetails } from '../../src/projects/pages/ProjectFoundationDetails';

const courseSource = readFileSync('src/course-overview/CourseOverview.jsx', 'utf8');
const projectSource = readFileSync('src/projects/pages/ProjectFoundationDetails.jsx', 'utf8');
const courseCss = readFileSync('src/styles/pages/dashboard.css', 'utf8');
const projectCss = readFileSync('src/styles/pages/projects.css', 'utf8');
const project = projectCatalog.getProjectById('cli-task-manager');

afterEach(cleanup);

describe('Course and Project overview content polish', () => {
  it('removes the Curriculum eyebrow and tightens the Course section spacing', () => {
    expect(courseSource).not.toContain('>Curriculum<');
    expect(courseSource).toContain('<h2>What you’ll learn</h2>');
    expect(courseCss).toMatch(/\.overview-modules \{[^}]*margin-top: var\(--space-8\);/s);
  });

  it('simplifies the Project hero and roadmap without changing roadmap semantics', () => {
    const progress = { status: 'active', currentCheckpoint: 1, completedCheckpoints: [project.checkpoints[0].id] };
    const { container } = render(<ProjectFoundationDetails project={project} progress={progress} onStart={vi.fn()} />);

    expect(container).not.toHaveTextContent(`Project · ${project.category}`);
    expect(screen.getByText('Easy')).toBeInTheDocument();
    const roadmap = container.querySelector('.project-roadmap');
    for (const checkpoint of project.checkpoints) {
      expect(within(roadmap).getByText(checkpoint.title)).toBeInTheDocument();
      expect(within(roadmap).queryByText(checkpoint.objective)).not.toBeInTheDocument();
    }
    expect(roadmap.children[0]).toHaveClass('is-complete');
    expect(roadmap.children[1]).toHaveClass('is-current');
  });

  it('moves the icon-free Skills block into the left overview card exactly once', () => {
    const { container } = render(<ProjectFoundationDetails project={project} progress={{ status: 'not-started', completedCheckpoints: [] }} onStart={vi.fn()} />);
    const cards = container.querySelectorAll('.project-details-grid>*');
    expect(within(cards[0]).getByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(within(cards[0]).getAllByText(project.skills[0]).length).toBeGreaterThan(0);
    expect(within(cards[1]).queryByRole('heading', { name: 'Skills' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Skills' })).toHaveLength(1);
    expect(projectSource).not.toContain('Target');
  });

  it('scopes the 18px heading and 16px body hierarchy to Project Overview', () => {
    expect(projectCss).toMatch(/\.project-details-grid h2,[\s\S]*?\.project-roadmap strong \{ font-size: 1\.125rem; \}/s);
    expect(projectCss).toMatch(/\.project-details-grid section \{[^}]*font-size: 1rem;/s);
    expect(projectCss).toMatch(/\.project-overview-skills span \{[^}]*font-size: 1rem;/s);
    expect(projectCss).toMatch(/\.project-roadmap li \{[^}]*align-items: center;/s);
    expect(projectCss).toMatch(/@media \(max-width: 1199px\)[\s\S]*?\.project-details-grid,[\s\S]*?grid-template-columns: 1fr;/s);
  });
});
