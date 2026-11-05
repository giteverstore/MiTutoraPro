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
  { id: 'currency-converter', title: 'Currency Converter' },
]);

export function learnerProjectCatalog(bundledProjects, publishedProjects) {
  const bingo = publishedProjects.find(({ id }) => id === 'bingo');
  const calculator = bundledProjects.find(({ id }) => id === 'simple-calculator');
  const blackjack = bundledProjects.find(({ id }) => id === 'blackjack');
  const hangman = bundledProjects.find(({ id }) => id === 'hangman');
  const stonePaperScissors = bundledProjects.find(({ id }) => id === 'stone-paper-scissors');
  return [
    ...(bingo ? [{ ...bingo, artwork: artwork.bingo }] : []),
    ...(calculator ? [{ ...calculator, artwork: artwork['simple-calculator'] }] : []),
    ...(blackjack ? [{ ...blackjack, artwork: artwork.blackjack }] : []),
    ...(hangman ? [{ ...hangman, artwork: artwork.hangman }] : []),
    ...(stonePaperScissors ? [{ ...stonePaperScissors, artwork: artwork['stone-paper-scissors'] }] : []),
    ...upcoming.map(({ id, title }) => ({ id, title, artwork: artwork[id], comingSoon: true, supportedLanguages: [], category: null, difficulty: null, checkpoints: [] })),
  ];
}
