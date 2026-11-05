import { sourceGuidePagesFor } from './projectGuideSourcePages.js';

const command = { type: 'runtime-command', command: 'run' };
const validation = (...checks) => ({ type: 'project-checks', checks });
const source = (id, name, patternsByLanguage) => ({ id, name, type: 'source_matches', patternsByLanguage, visible: true });

const languages = ['python', 'cpp', 'java'];
const patterns = (python, cpp, java) => ({ python: [python], cpp: [cpp], java: [java] });

const taskDefinitions = [
  ['welcome', 'Welcome Message', 'Create the language-specific entry file and print the Blackjack welcome message.', ['Print “Welcome to Blackjack!”.'], patterns('Welcome to Blackjack', 'Welcome to Blackjack', 'Welcome to Blackjack')],
  ['constants', 'Ranks and Suits', 'Define the standard card ranks and suits.', ['Define all thirteen ranks.', 'Define all four suits.'], patterns('RANKS[\\s\\S]*SUITS', 'RANKS[\\s\\S]*SUITS', 'RANKS[\\s\\S]*SUITS')],
  ['card', 'Card Model', 'Create a Card type that stores rank and suit and has a readable string form.', ['Store rank and suit.', 'Return a readable card representation.'], patterns('class\\s+Card', '(?:class|struct)\\s+Card', 'class\\s+Card')],
  ['deck', 'Build the Deck', 'Create and populate a complete 52-card deck.', ['Create one card for every rank and suit combination.', 'Produce exactly 52 cards.'], patterns('for[\\s\\S]+RANKS[\\s\\S]+SUITS', 'for[\\s\\S]+RANKS[\\s\\S]+SUITS', 'for[\\s\\S]+RANKS[\\s\\S]+SUITS')],
  ['shuffle', 'Shuffle the Deck', 'Randomize the deck before dealing.', ['Use the language’s standard randomization utility.'], patterns('(?:shuffle|random)', '(?:shuffle|random)', '(?:shuffle|Random)')],
  ['deal', 'Deal a Card', 'Remove and return one card from the deck.', ['Deal from the deck without duplicating a card.'], patterns('(?:pop|deal)', '(?:pop_back|deal)', '(?:remove|deal)')],
  ['score', 'Score a Hand', 'Calculate a hand value and adjust Aces from 11 to 1 when needed.', ['Score number and face cards.', 'Adjust Aces while the total exceeds 21.'], patterns('(?:score|value)[\\s\\S]+ace', '(?:score|value)[\\s\\S]+ace', '(?:score|value)[\\s\\S]+ace')],
  ['display', 'Display Hands', 'Show player and dealer hands while supporting a hidden dealer hole card.', ['Display every player card.', 'Hide the dealer hole card until it should be revealed.'], patterns('(?:hidden|hole)', '(?:hidden|hole)', '(?:hidden|hole)')],
  ['player-turn', 'Player Turn', 'Prompt for Hit or Stand and reject invalid choices safely.', ['Accept Hit and Stand.', 'Repeat the prompt after invalid input.'], patterns('(?:hit|stand)[\\s\\S]+(?:invalid|while)', '(?:hit|stand)[\\s\\S]+(?:invalid|while)', '(?:hit|stand)[\\s\\S]+(?:invalid|while)')],
  ['dealer-turn', 'Dealer Turn', 'Automate dealer play by hitting until the score reaches at least 17.', ['Dealer hits below 17.', 'Dealer stands at 17 or higher.'], patterns('dealer[\\s\\S]+17', 'dealer[\\s\\S]+17', 'dealer[\\s\\S]+17')],
  ['outcome', 'Round Outcome', 'Determine player win, dealer win, bust, Blackjack, and push outcomes.', ['Compare final scores.', 'Handle busts and ties.'], patterns('(?:push|tie)[\\s\\S]+(?:bust|blackjack|win)', '(?:push|tie)[\\s\\S]+(?:bust|blackjack|win)', '(?:push|tie)[\\s\\S]+(?:bust|blackjack|win)')],
  ['scoreboard', 'Session Scoreboard', 'Track and display player wins, dealer wins, and pushes across rounds.', ['Persist round counts for the session.', 'Display the scoreboard.'], patterns('(?:playerWins|player_wins)[\\s\\S]+(?:dealerWins|dealer_wins)[\\s\\S]+push', '(?:playerWins|player_wins)[\\s\\S]+(?:dealerWins|dealer_wins)[\\s\\S]+push', '(?:playerWins|player_wins)[\\s\\S]+(?:dealerWins|dealer_wins)[\\s\\S]+push')],
  ['game', 'Round Lifecycle', 'Create BlackjackGame and coordinate a complete round in playRound().', ['Create BlackjackGame.', 'Coordinate dealing, turns, outcome, and scoreboard.'], patterns('class\\s+BlackjackGame[\\s\\S]+play_round', '(?:class|struct)\\s+BlackjackGame[\\s\\S]+playRound', 'class\\s+BlackjackGame[\\s\\S]+playRound')],
  ['replay', 'Replay Prompt', 'Implement askReplay() with defensive yes/no input handling.', ['Accept yes or no.', 'Reject invalid replay choices.'], patterns('ask_replay', 'askReplay', 'askReplay')],
  ['continuous', 'Continuous Session', 'Implement playMany() so rounds repeat until the learner exits.', ['Repeat complete rounds.', 'Stop cleanly when replay is declined.'], patterns('play_many', 'playMany', 'playMany')],
  ['main', 'Application Entry Point', 'Assemble the main entry point and final session flow.', ['Print the welcome message.', 'Run the continuous session.', 'Print final statistics and thanks.'], patterns('(?:def\\s+main|__name__)', 'int\\s+main', 'static\\s+void\\s+main')],
];

const checkpoints = taskDefinitions.map(([id, title, objective, requirements, taskPatterns], index) => ({
  id: `blackjack-task-${index + 1}`,
  title: `Task ${index + 1}: ${title}`,
  objective,
  executionMode: 'run_or_terminal',
  requirements,
  completionMessage: `${title} milestone verified.`,
  validation: validation(source(id, title, taskPatterns)),
  guide: [
    { type: 'heading', text: title },
    { type: 'paragraph', text: objective },
    { type: 'list', items: requirements },
    command,
  ],
}));

const starterWorkspaces = {
  python: [{ path: 'Blackjack.py', content: '"""Blackjack project starter."""\n\n\ndef main():\n    print("Welcome to Blackjack!")\n\n\nif __name__ == "__main__":\n    main()\n' }],
  cpp: [{ path: 'Blackjack.cpp', content: '#include <iostream>\n\nint main() {\n  std::cout << "Welcome to Blackjack!" << std::endl;\n  return 0;\n}\n' }],
  java: [{ path: 'Blackjack.java', content: 'public class Blackjack {\n  public static void main(String[] args) {\n    System.out.println("Welcome to Blackjack!");\n  }\n}\n' }],
};

const finalValidation = validation(
  { id: 'blackjack-runs', name: 'Blackjack application starts', type: 'execution', outputIncludes: ['Welcome to Blackjack!'], stdin: '', visible: true },
  ...taskDefinitions.slice(1).map(([id, title, , , taskPatterns]) => source(`final-${id}`, title, taskPatterns)),
);

export const blackjackProject = {
  id: 'blackjack', slug: 'blackjack', title: 'Blackjack', difficulty: 'Beginner', category: 'Command-line games',
  description: 'Build an interactive, turn-based command-line Blackjack game against an automated dealer and compete to get closest to 21.',
  estimatedMinutes: 0,
  supportedLanguages: languages,
  whatYouWillBuild: 'A complete command-line Blackjack game with a shuffled 52-card deck, Ace-aware scoring, player and dealer turns, round outcomes, replay, and a persistent session scoreboard.',
  learningObjectives: [
    'Represent cards with ranks and suits.', 'Generate and shuffle a standard 52-card deck.', 'Implement dual-value Ace scoring.',
    'Deal hands while preserving hidden dealer state.', 'Validate Hit and Stand input.', 'Automate dealer play through 17.',
    'Resolve wins, busts, Blackjack, and pushes.', 'Track a scoreboard across rounds.', 'Coordinate the lifecycle with BlackjackGame.',
  ],
  prerequisites: ['Printing output and reading input', 'Variables, conditionals, and loops', 'Arrays, lists, or vectors', 'Classes, structs, and objects', 'Functions or methods', 'Random-number utilities'],
  skills: ['Object modeling', 'Collections', 'Game loops', 'Input validation', 'Randomization', 'State management'],
  guide: [{ type: 'paragraph', text: 'Build the game in the exact task order. Validate each milestone before moving to the next one.' }, command],
  guidePages: sourceGuidePagesFor('blackjack'),
  languageOverrides: {
    python: { entrypoint: 'Blackjack.py', runCommand: 'python Blackjack.py', defaultFiles: starterWorkspaces.python },
    cpp: { entrypoint: 'Blackjack.cpp', buildCommand: 'g++ Blackjack.cpp -o blackjack', runCommand: './blackjack', defaultFiles: starterWorkspaces.cpp },
    java: { entrypoint: 'Blackjack.java', buildCommand: 'javac Blackjack.java', runCommand: 'java Blackjack', defaultFiles: starterWorkspaces.java },
  },
  checkpoints,
  finalValidation,
  export: { repositoryName: 'blackjack' },
};
