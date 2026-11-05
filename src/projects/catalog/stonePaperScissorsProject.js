const command = { type: 'runtime-command', command: 'run' };
const validation = (...checks) => ({ type: 'project-checks', checks });
const source = (id, name, patternsByLanguage) => ({ id, name, type: 'source_matches', patternsByLanguage, visible: true });
const patterns = (python, cpp, java) => ({ python: [python], cpp: [cpp], java: [java] });

const tasks = [
  ['welcome', 'Welcome Banner', 'Create the language-specific entry file and print the official game greeting.', ['Create StonePaperScissors.py, StonePaperScissors.cpp, or StonePaperScissors.java.', 'Define print_welcome() or printWelcome().', 'Print “Welcome to Stone Paper Scissors!”.'], patterns('(?:print_welcome|Welcome to Stone Paper Scissors)', '(?:printWelcome|Welcome to Stone Paper Scissors)', '(?:printWelcome|Welcome to Stone Paper Scissors)')],
  ['configuration', 'Moves and Target Score', 'Define the three valid moves and the first-to-3 match boundary.', ['MOVES contains Stone, Paper, and Scissors in that order.', 'TARGET_SCORE equals 3.'], patterns('MOVES[\\s\\S]+TARGET_SCORE', 'MOVES[\\s\\S]+TARGET_SCORE', 'MOVES[\\s\\S]+TARGET_SCORE')],
  ['round-result', 'Round Result Model', 'Create a model that stores the winner identifier and explanatory reason.', ['Store draw, player, or system as the winner.', 'Store a plain-English outcome reason.'], patterns('class\\s+RoundResult', '(?:class|struct)\\s+RoundResult', 'class\\s+RoundResult')],
  ['winner', 'Winner Rules', 'Determine draws and all Stone, Paper, and Scissors winning combinations.', ['Return a draw for equal moves.', 'Evaluate the three player-winning combinations.', 'Return the corresponding system result otherwise.'], patterns('determine_winner', 'determineWinner', 'determineWinner')],
  ['player', 'Player Model', 'Create a named Player whose score starts at zero.', ['Require a clean non-empty display name.', 'Initialize score to zero.'], patterns('class\\s+Player', '(?:class|struct)\\s+Player', 'class\\s+Player')],
  ['reset-score', 'Reset Player Score', 'Reset a Player score to zero for a new match.', ['Provide reset_score() or resetScore().', 'Set score back to zero.'], patterns('reset_score', 'resetScore', 'resetScore')],
  ['human-move', 'Validated Human Move', 'Prompt until the human enters a supported numeric key or move alias.', ['Present the three moves.', 'Trim and lowercase input.', 'Map supported numeric keys and aliases to canonical move names.', 'Report invalid input and re-prompt.'], patterns('(?:get_move|getMove)[\\s\\S]+(?:stone|paper|scissors)', '(?:getMove|chooseMove)[\\s\\S]+(?:stone|paper|scissors)', '(?:getMove|chooseMove)[\\s\\S]+(?:stone|paper|scissors)')],
  ['system-player', 'System Player', 'Create SystemPlayer by inheriting Player and fixing its name to System.', ['Extend or inherit Player.', 'Use System as the participant name.'], patterns('class\\s+SystemPlayer\\s*\\(Player\\)', '(?:class|struct)\\s+SystemPlayer', 'class\\s+SystemPlayer\\s+extends\\s+Player')],
  ['system-move', 'Random System Move', 'Choose and return one move uniformly from MOVES.', ['Use the standard random utility.', 'Return a canonical move from MOVES.'], patterns('(?:random|choice)[\\s\\S]+MOVES', '(?:random|shuffle|uniform)[\\s\\S]+MOVES', '(?:Random|random)[\\s\\S]+MOVES')],
  ['game', 'Game Controller', 'Create Game with a human Player, SystemPlayer, and the target score.', ['Store the human participant.', 'Store the system opponent.', 'Store TARGET_SCORE.'], patterns('class\\s+Game', '(?:class|struct)\\s+Game', 'class\\s+Game')],
  ['scoreboard', 'Formatted Scoreboard', 'Render the decorative live score card.', ['Print the top and bottom borders.', 'Display both participant names and scores.'], patterns('(?:display_scoreboard|scoreboard)', '(?:displayScoreboard|scoreboard)', '(?:displayScoreboard|scoreboard)')],
  ['round', 'Play One Round', 'Collect both moves, reveal them, score the outcome, and show the scoreboard.', ['Announce the round.', 'Reveal player and system moves.', 'Award one point to the winner.', 'Print the reason and updated scoreboard.'], patterns('play_round', 'playRound', 'playRound')],
  ['champion', 'Match Champion', 'Compare final scores and announce the match winner.', ['Print the concluding match banner.', 'Declare the player or System champion from final scores.'], patterns('(?:announce_champion|champion)', '(?:announceChampion|champion)', '(?:announceChampion|champion)')],
  ['match', 'First-to-3 Match', 'Reset scores and play rounds until either participant reaches TARGET_SCORE.', ['Reset both scores.', 'Initialize the round counter.', 'Loop while both scores are below the target.', 'Announce the champion after the loop.'], patterns('play_match', 'playMatch', 'playMatch')],
  ['replay', 'Replay Prompt', 'Ask for a rematch and accept only the source-defined affirmative or negative responses.', ['Normalize the response.', 'Return true or false for supported responses.', 'Re-prompt after invalid input.'], patterns('ask_replay', 'askReplay', 'askReplay')],
  ['session', 'Continuous Matches', 'Run complete matches until replay is declined, then print the farewell.', ['Call the complete match loop.', 'Ask for replay after every match.', 'Exit cleanly with the closing message.'], patterns('play_many', 'playMany', 'playMany')],
  ['main', 'Application Entry Point', 'Print the banner, read the player name, create Game, and launch continuous play.', ['Call the welcome function.', 'Prompt for the player name.', 'Instantiate Game.', 'Call play_many() or playMany().'], patterns('(?:def\\s+main|__name__)', 'int\\s+main', 'static\\s+void\\s+main')],
];

const checkpoints = tasks.map(([id, title, objective, requirements, taskPatterns], index) => ({
  id: `stone-paper-scissors-task-${index + 1}`, title: `Task ${index + 1}: ${title}`, objective,
  executionMode: 'run_or_terminal', requirements, completionMessage: `${title} milestone verified.`,
  validation: validation(source(id, title, taskPatterns)),
  guide: [{ type: 'heading', text: title }, { type: 'paragraph', text: objective }, { type: 'list', items: requirements }, command],
}));

const starters = {
  python: [{ path: 'StonePaperScissors.py', content: '"""Stone Paper Scissors project starter."""\n\n\ndef print_welcome():\n    print("Welcome to Stone Paper Scissors!")\n\n\ndef main():\n    print_welcome()\n\n\nif __name__ == "__main__":\n    main()\n' }],
  cpp: [{ path: 'StonePaperScissors.cpp', content: '#include <iostream>\n\nvoid printWelcome() {\n  std::cout << "Welcome to Stone Paper Scissors!" << std::endl;\n}\n\nint main() {\n  printWelcome();\n  return 0;\n}\n' }],
  java: [{ path: 'StonePaperScissors.java', content: 'public class StonePaperScissors {\n  static void printWelcome() {\n    System.out.println("Welcome to Stone Paper Scissors!");\n  }\n\n  public static void main(String[] args) {\n    printWelcome();\n  }\n}\n' }],
};

const finalValidation = validation(
  { id: 'stone-paper-scissors-runs', name: 'Stone Paper Scissors application starts', type: 'execution', outputIncludes: ['Welcome to Stone Paper Scissors!'], stdin: '', visible: true },
  ...tasks.slice(1).map(([id, title, , , taskPatterns]) => source(`final-${id}`, title, taskPatterns)),
);

export const stonePaperScissorsProject = {
  id: 'stone-paper-scissors', slug: 'stone-paper-scissors', title: 'Stone Paper Scissors', difficulty: 'Beginner', category: 'Command-line games', estimatedMinutes: 0,
  description: 'Build a match-based command-line Stone Paper Scissors game against a randomized System opponent.',
  supportedLanguages: ['python', 'cpp', 'java'],
  whatYouWillBuild: 'A complete first-to-3 Stone Paper Scissors game with validated human input, randomized System moves, descriptive round results, live scoreboards, champion announcements, and continuous rematches.',
  learningObjectives: ['Represent moves and configuration with immutable constants.', 'Encapsulate winner and reason in a result model.', 'Validate numeric codes and string aliases defensively.', 'Generate unpredictable System moves.', 'Evaluate every move pairing with descriptive reasons.', 'Run a first-to-3 match with score tracking.', 'Render an ASCII scoreboard after each round.', 'Support consecutive matches through rematches.'],
  prerequisites: ['Printing output and reading keyboard input', 'Variables, conditionals, and while loops', 'Basic functions and methods', 'Lists or arrays', 'Simple classes and objects', 'Random-number utilities'],
  skills: ['Collections', 'Input validation', 'Randomization', 'Inheritance', 'Outcome modeling', 'Match loops'],
  guide: [{ type: 'paragraph', text: 'Build the game in the exact 17-task order and validate each milestone before continuing.' }, command],
  languageOverrides: {
    python: { entrypoint: 'StonePaperScissors.py', runCommand: 'python StonePaperScissors.py', defaultFiles: starters.python },
    cpp: { entrypoint: 'StonePaperScissors.cpp', buildCommand: 'g++ -std=c++17 StonePaperScissors.cpp -o stone-paper-scissors', runCommand: './stone-paper-scissors', defaultFiles: starters.cpp },
    java: { entrypoint: 'StonePaperScissors.java', buildCommand: 'javac StonePaperScissors.java', runCommand: 'java StonePaperScissors', defaultFiles: starters.java },
  },
  checkpoints, finalValidation, export: { repositoryName: 'stone-paper-scissors' },
};
