import { courseDifficultyBadge } from '../../components/DifficultyBadge';

const difficultyOrder = Object.freeze({ easy: 0, medium: 1, hard: 2 });

export function projectDisplayDifficulty(value) {
  return courseDifficultyBadge(value);
}

export function sortProjectsByDifficulty(projects) {
  return [...projects].sort((left, right) =>
    (difficultyOrder[projectDisplayDifficulty(left.difficulty)] ?? 3)
      - (difficultyOrder[projectDisplayDifficulty(right.difficulty)] ?? 3));
}

export function projectArtwork(project) {
  if (project.artwork === 'terminal') return { kind: 'terminal' };
  if (typeof project.artwork === 'string' && project.artwork.startsWith('/assets/')) {
    return { kind: 'image', src: project.artwork };
  }
  return null;
}
