import { sourceGuidePagesFor } from './projectGuideSourcePages.js';

const command = { type: 'runtime-command', command: 'run' };
const validation = (...checks) => ({ type: 'project-checks', checks });
const source = (id, name, patternsByLanguage) => ({ id, name, type: 'source_matches', patternsByLanguage, visible: true });
const patterns = (python, cpp, java) => ({ python: [python], cpp: [cpp], java: [java] });

const tasks = [
  ['welcome', 'Welcome Banner', 'Create the language-specific entry file and print the official welcome message.', ['Create Hangman.py, Hangman.cpp, or Hangman.java.', 'Define print_welcome() or printWelcome().', 'Print “Welcome to Hangman!”.'], patterns('(?:print_welcome|Welcome to Hangman)', '(?:printWelcome|Welcome to Hangman)', '(?:printWelcome|Welcome to Hangman)')],
  ['configuration', 'Game Configuration', 'Define the approved word pool, maximum lives, and seven gallows stages.', ['WORDS contains PYTHON, PLANET, ROBOT, GUITAR, SILVER, ROCKET, and CODING.', 'MAX_LIVES equals 6.', 'STAGES contains seven progressive drawings.'], patterns('WORDS[\\s\\S]+MAX_LIVES[\\s\\S]+STAGES', 'WORDS[\\s\\S]+MAX_LIVES[\\s\\S]+STAGES', 'WORDS[\\s\\S]+MAX_LIVES[\\s\\S]+STAGES')],
  ['masked-word', 'Masked Word', 'Build the spaced masked word from the secret word and guessed letters.', ['Reveal guessed letters.', 'Replace unknown letters with underscores.', 'Separate display characters with one space.'], patterns('get_masked_word', 'getMaskedWord', 'getMaskedWord')],
  ['word-guessed', 'Win Condition', 'Return whether every letter in the secret word has been guessed.', ['Return false when any letter remains hidden.', 'Return true only when the word is complete.'], patterns('is_word_guessed', 'isWordGuessed', 'isWordGuessed')],
  ['format-guesses', 'Guessed Letters', 'Format prior guesses in alphabetical order.', ['Return “None” for an empty collection.', 'Sort letters and join them with comma-space separators.'], patterns('format_guessed_letters', 'formatGuessedLetters', 'formatGuessedLetters')],
  ['display-board', 'Game Board', 'Render the gallows, masked word, guessed letters, and remaining lives.', ['Select STAGES by wrong guess count.', 'Show the masked word and guessed letters.', 'Show MAX_LIVES minus wrong guesses.'], patterns('display_board', 'displayBoard', 'displayBoard')],
  ['read-guess', 'Read Guess', 'Prompt for one letter and normalize it to uppercase.', ['Use the source-defined single-letter prompt.', 'Trim whitespace and uppercase the input.'], patterns('read_raw_guess', 'readRawGuess', 'readRawGuess')],
  ['valid-format', 'Validate Guess Format', 'Accept exactly one alphabetic character.', ['Reject empty or multi-character input.', 'Reject digits, punctuation, and symbols.'], patterns('is_valid_format', 'isValidFormat', 'isValidFormat')],
  ['valid-guess', 'Finalize Guess', 'Reject invalid and repeated guesses until a fresh letter is entered.', ['Report invalid format.', 'Report duplicate guesses.', 'Return a valid fresh uppercase letter.'], patterns('get_valid_guess', 'getValidGuess', 'getValidGuess')],
  ['state', 'Hangman State', 'Create the Hangman class and initialize round state.', ['Initialize secret word to empty.', 'Initialize guessed letters to empty.', 'Initialize wrong guesses to zero.'], patterns('class\\s+Hangman', '(?:class|struct)\\s+Hangman', 'class\\s+Hangman')],
  ['reset', 'Reset Game', 'Choose a random approved word and clear round state.', ['Select from WORDS.', 'Clear guessed letters.', 'Reset wrong guesses to zero.'], patterns('reset_game', 'resetGame', 'resetGame')],
  ['process', 'Process Guess', 'Record a guess, announce a hit or miss, and increment mistakes only for misses.', ['Append the guessed letter.', 'Print positive feedback for a hit.', 'Increment wrong guesses and print miss feedback otherwise.'], patterns('process_guess', 'processGuess', 'processGuess')],
  ['outcome', 'Announce Outcome', 'Render the final board and announce victory or defeat with the secret word.', ['Display the final board.', 'Congratulate a solved word.', 'Reveal the word after defeat.'], patterns('announce_result', 'announceResult', 'announceResult')],
  ['round', 'Single-Game Loop', 'Coordinate reset, board display, valid input, guess processing, and outcome.', ['Reset before each round.', 'Continue while lives remain and the word is unsolved.', 'Announce the result after the loop.'], patterns('play_round', 'playRound', 'playRound')],
  ['replay', 'Replay Prompt', 'Ask whether to play again and accept only y or n.', ['Normalize the reply.', 'Return true for y and false for n.', 'Re-prompt after invalid input.'], patterns('ask_replay', 'askReplay', 'askReplay')],
  ['session', 'Multi-Game Session', 'Repeat complete rounds until replay is declined.', ['Call the single-round loop.', 'Ask for replay after each round.', 'Print the source-defined farewell when exiting.'], patterns('play_many', 'playMany', 'playMany')],
  ['main', 'Application Entry Point', 'Print the welcome banner, create Hangman, and launch the session.', ['Call the welcome function.', 'Instantiate Hangman.', 'Call play_many() or playMany().'], patterns('(?:def\\s+main|__name__)', 'int\\s+main', 'static\\s+void\\s+main')],
];

const checkpoints = tasks.map(([id, title, objective, requirements, taskPatterns], index) => ({
  id: `hangman-task-${index + 1}`, title: `Task ${index + 1}: ${title}`, objective,
  executionMode: 'run_or_terminal', requirements, completionMessage: `${title} milestone verified.`,
  validation: validation(source(id, title, taskPatterns)),
  guide: [{ type: 'heading', text: title }, { type: 'paragraph', text: objective }, { type: 'list', items: requirements }, command],
}));

const starters = {
  python: [{ path: 'Hangman.py', content: '"""Hangman project starter."""\n\n\ndef print_welcome():\n    print("Welcome to Hangman!")\n\n\ndef main():\n    print_welcome()\n\n\nif __name__ == "__main__":\n    main()\n' }],
  cpp: [{ path: 'Hangman.cpp', content: '#include <iostream>\n\nvoid printWelcome() {\n  std::cout << "Welcome to Hangman!" << std::endl;\n}\n\nint main() {\n  printWelcome();\n  return 0;\n}\n' }],
  java: [{ path: 'Hangman.java', content: 'public class Hangman {\n  static void printWelcome() {\n    System.out.println("Welcome to Hangman!");\n  }\n\n  public static void main(String[] args) {\n    printWelcome();\n  }\n}\n' }],
};

const finalValidation = validation(
  { id: 'hangman-runs', name: 'Hangman application starts', type: 'execution', outputIncludes: ['Welcome to Hangman!'], stdin: '', visible: true },
  ...tasks.slice(1).map(([id, title, , , taskPatterns]) => source(`final-${id}`, title, taskPatterns)),
);

export const hangmanProject = {
  id: 'hangman', slug: 'hangman', title: 'Hangman', difficulty: 'Beginner', category: 'Command-line games', estimatedMinutes: 0,
  description: 'Build a fully functional terminal word-guessing game with defensive input, progressive gallows art, and continuous replay.',
  supportedLanguages: ['python', 'cpp', 'java'],
  whatYouWillBuild: 'An interactive, object-oriented Hangman game that selects from an approved word bank, masks and reveals letters, tracks six lives, renders seven gallows stages, validates guesses, resolves wins and losses, and supports rematches.',
  learningObjectives: ['Maintain immutable word collections and configuration constants.', 'Mask and reveal secret strings from guess history.', 'Validate character count, alphabetic input, and duplicate guesses.', 'Render seven ASCII gallows stages from remaining lives.', 'Encapsulate round data in a Hangman class.', 'Drive a turn-based update and presentation loop.', 'Handle victory and defeat with clear feedback.', 'Implement a continuous rematch cycle.'],
  prerequisites: ['Terminal input and output', 'Primitive data types, strings, lists, vectors, and arrays', 'Conditionals and loops', 'Basic classes and instance methods'],
  skills: ['String manipulation', 'Input validation', 'State tracking', 'ASCII rendering', 'Object-oriented design', 'Game loops'],
  guide: [{ type: 'paragraph', text: 'Build the Hangman application in the exact 17-task order and validate every milestone before continuing.' }, command],
  guidePages: sourceGuidePagesFor('hangman'),
  languageOverrides: {
    python: { entrypoint: 'Hangman.py', runCommand: 'python Hangman.py', defaultFiles: starters.python },
    cpp: { entrypoint: 'Hangman.cpp', buildCommand: 'g++ Hangman.cpp -o hangman', runCommand: './hangman', defaultFiles: starters.cpp },
    java: { entrypoint: 'Hangman.java', buildCommand: 'javac Hangman.java', runCommand: 'java Hangman', defaultFiles: starters.java },
  },
  checkpoints, finalValidation, export: { repositoryName: 'hangman' },
};
