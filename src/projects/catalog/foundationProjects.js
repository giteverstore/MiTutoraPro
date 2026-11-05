import { cliTaskManagerProject } from './cliTaskManagerProject.js';
import { blackjackProject } from './blackjackProject.js';
import { hangmanProject } from './hangmanProject.js';
import { stonePaperScissorsProject } from './stonePaperScissorsProject.js';

// Compatibility export for callers introduced with the Projects foundation.
export const foundationProjects = Object.freeze([cliTaskManagerProject, blackjackProject, hangmanProject, stonePaperScissorsProject]);
