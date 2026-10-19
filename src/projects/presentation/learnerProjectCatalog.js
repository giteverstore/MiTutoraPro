// Learner catalog visibility only. Canonical and bundled Project records remain unchanged.
const artwork = Object.freeze({
  bingo: '/assets/projects/bingo.webp',
  'simple-calculator': '/assets/projects/simple-calculator.webp',
  blackjack: '/assets/projects/blackjack.webp',
  hangman: '/assets/projects/hangman.webp',
  'stone-paper-scissors': '/assets/projects/stone-paper-scissors.webp',
  'currency-converter': '/assets/projects/currency-converter.webp',
});

const upcoming = Object.freeze([
  { id: 'blackjack', title: 'Blackjack' },
  { id: 'hangman', title: 'Hangman' },
  { id: 'stone-paper-scissors', title: 'Stone Paper Scissors' },
  { id: 'currency-converter', title: 'Currency Converter' },
]);

export function learnerProjectCatalog(bundledProjects, publishedProjects) {
  const bingo = publishedProjects.find(({ id }) => id === 'bingo');
  const calculator = bundledProjects.find(({ id }) => id === 'simple-calculator');
  return [
    ...(bingo ? [{ ...bingo, artwork: artwork.bingo }] : []),
    ...(calculator ? [{ ...calculator, artwork: artwork['simple-calculator'] }] : []),
    ...upcoming.map(({ id, title }) => ({ id, title, artwork: artwork[id], comingSoon: true, supportedLanguages: [], category: null, difficulty: null, checkpoints: [] })),
  ];
}
