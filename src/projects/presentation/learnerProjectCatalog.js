// Learner catalog visibility only. Canonical and bundled Project records remain unchanged.
const artwork = Object.freeze({
  bingo: '/assets/projects/bingo.png',
  'simple-calculator': '/assets/projects/simple-calculator.png',
  blackjack: '/assets/projects/blackjack.png',
  hangman: '/assets/projects/hangman.png',
  'stone-paper-scissors': '/assets/projects/stone-paper-scissors.png',
  'currency-converter': '/assets/projects/currency-converter.png',
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
