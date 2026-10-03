const command = { type: 'runtime-command', command: 'run' };
const hint = (key) => ({ type: 'language-hint', key });
const snippet = (key) => ({ type: 'code', codeKey: key });
const validation = (...checks) => ({ type: 'project-checks', checks });
const source = (id, name, patternsByLanguage, visible = true) => ({ id, name, type: 'source_matches', patternsByLanguage, visible });
const execute = (id, name, outputIncludes, stdin = '') => ({ id, name, type: 'execution', outputIncludes, stdin, visible: true });

const languageContent = {
  python: {
    taskModelHint: 'A small class or dataclass is a natural representation. A consistent dictionary is also valid.',
    taskModelCode: 'class Task:\n    def __init__(self, title):\n        self.title = title\n        self.completed = False',
    inputCode: 'choice = input("Choose an option: ").strip()',
    persistenceHint: 'Use the json module to serialize simple task data. Treat a missing tasks.json file as an empty task list.',
    persistenceCode: 'with open("tasks.json", "w", encoding="utf-8") as file:\n    json.dump(task_data, file)', persistenceFile: 'tasks.json',
  },
  javascript: {
    taskModelHint: 'An object or a small class can represent a task. Keep title and completed properties consistent.',
    taskModelCode: 'const task = { title: "Read the guide", completed: false };',
    inputCode: '// Read a command from standard input, then normalize it with trim().',
    persistenceHint: 'Use JSON.stringify and JSON.parse around a tasks.json file when filesystem access is available. Treat a missing file as an empty list.',
    persistenceCode: 'const fs = require("fs");\nfs.writeFileSync("tasks.json", JSON.stringify(tasks, null, 2));', persistenceFile: 'tasks.json',
  },
  java: {
    taskModelHint: 'A Task class is natural. It may be nested in Main.java while Projects supports one executable source file.',
    taskModelCode: 'static class Task {\n    String title;\n    boolean completed;\n    Task(String title) {\n        this.title = title;\n        this.completed = false;\n    }\n}',
    inputCode: 'Scanner scanner = new Scanner(System.in);\nString choice = scanner.nextLine().trim();',
    persistenceHint: 'Put serialization behind loadTasks and saveTasks methods. A missing file should produce an empty collection.',
    persistenceCode: 'Path dataFile = Path.of("tasks.txt");\nif (!Files.exists(dataFile)) return new ArrayList<>();', persistenceFile: 'tasks.txt',
  },
  cpp: {
    taskModelHint: 'A struct is concise; a class is equally valid if you want to protect its state.',
    taskModelCode: 'struct Task {\n    std::string title;\n    bool completed = false;\n};',
    inputCode: 'std::string choice;\nstd::getline(std::cin, choice);',
    persistenceHint: 'Use fstream for a small text representation. If the input file cannot be opened, begin with an empty vector.',
    persistenceCode: 'std::ifstream input("tasks.txt");\nif (!input) return {};', persistenceFile: 'tasks.txt',
  },
};

const representations = validation(
  source('title', 'Task representation stores a title', { python: ['title'], javascript: ['title'], java: ['String\\s+title'], cpp: ['std::string\\s+title'] }),
  source('completed', 'Task representation stores completion state', { python: ['completed'], javascript: ['completed'], java: ['boolean\\s+completed'], cpp: ['bool\\s+completed'] }),
  source('constructible', 'A task can be created', { python: ['(?:class\\s+Task|["\']title["\'])'], javascript: ['(?:class\\s+Task|\\{[^}]*title)'], java: ['(?:class|record)\\s+Task'], cpp: ['(?:struct|class)\\s+Task'] }, false),
);
const operations = validation(
  execute('operations-workflow', 'Add and list workflow runs', ['Task Manager', 'Read the guide'], '1\nRead the guide\n2\n5\n'),
  source('add', 'Tasks can be added', { python: ['(?:append|add_task)'], javascript: ['(?:push|addTask)'], java: ['(?:\\.add\\(|addTask)'], cpp: ['(?:push_back|addTask)'] }),
  source('list', 'Tasks can be listed', { python: ['(?:for\\s+.+\\s+in|list_tasks)'], javascript: ['(?:forEach|for\\s*\\(|listTasks)'], java: ['(?:for\\s*\\(|listTasks)'], cpp: ['(?:for\\s*\\(|listTasks)'] }),
  source('complete', 'Tasks can be completed', { python: ['(?:completed\\s*=\\s*True|complete_task)'], javascript: ['(?:completed\\s*=\\s*true|completeTask)'], java: ['(?:completed\\s*=\\s*true|completeTask)'], cpp: ['(?:completed\\s*=\\s*true|completeTask)'] }),
  source('delete', 'Tasks can be deleted', { python: ['(?:pop\\(|remove\\(|delete_task)'], javascript: ['(?:splice\\(|deleteTask)'], java: ['(?:\\.remove\\(|deleteTask)'], cpp: ['(?:\\.erase\\(|deleteTask)'] }),
);
const persistence = validation(
  { id: 'persist-first-run', name: 'Persistence file is created', type: 'execution', stdin: '1\nPersisted task\n5\n', outputIncludes: ['Task Manager'], filePathByLanguage: { python: 'tasks.json', javascript: 'tasks.json', cpp: 'tasks.txt' }, requiresFilesystem: true, visible: true },
  { id: 'persist-second-run', name: 'Saved task reloads on the next run', type: 'execution', stdin: '2\n5\n', outputIncludes: ['Persisted task'], requiresFilesystem: true, visible: true },
  source('save', 'Task data is saved', { python: ['(?:json\\.dump|open\\([^)]*["\']w)'], javascript: ['(?:JSON\\.stringify|writeFile)'], java: ['(?:Files\\.write|FileWriter|BufferedWriter)'], cpp: ['(?:ofstream|fstream)'] }),
  source('load', 'Task data can be loaded', { python: ['(?:json\\.load|open\\()'], javascript: ['(?:JSON\\.parse|readFile)'], java: ['(?:Files\\.read|FileReader|BufferedReader)'], cpp: ['(?:ifstream|fstream)'] }),
  source('missing', 'A missing data file is handled', { python: ['(?:FileNotFoundError|exists\\()'], javascript: ['(?:try\\s*\\{|existsSync|ENOENT)'], java: ['(?:Files\\.exists|NoSuchFileException|FileNotFoundException)'], cpp: ['(?:is_open\\(|if\\s*\\([^)]*!\\s*(?:input|file))'] }, false),
);
const finalValidation = validation(
  execute('starts', 'Application starts', ['Task Manager'], '5\n'),
  execute('workflow', 'Complete task workflow runs', ['Task Manager', 'Production task'], '1\nProduction task\n2\n3\n1\n4\n1\n5\n'),
  execute('invalid-runtime', 'Invalid input returns safely', ['Invalid'], 'not-a-choice\n5\n'),
  source('menu', 'Complete menu is displayed', Object.fromEntries(['python', 'javascript', 'java', 'cpp'].map((id) => [id, ['Add Task', 'List Tasks', 'Complete Task', 'Delete Task', 'Exit']]))),
  ...operations.checks, ...persistence.checks,
  source('invalid', 'Invalid choices are handled', { python: ['(?:Invalid|ValueError|try:)'], javascript: ['(?:Invalid|default\\s*:)'], java: ['(?:Invalid|default\\s*:)'], cpp: ['(?:Invalid|default\\s*:)'] }),
  source('exit', 'Application exits cleanly', { python: ['(?:break|return)'], javascript: ['(?:break|return|process\\.exit)'], java: ['(?:break|return)'], cpp: ['(?:break|return)'] }),
);

export const cliTaskManagerProject = {
  id: 'cli-task-manager', slug: 'cli-task-manager', title: 'CLI Task Manager', difficulty: 'Beginner', category: 'Command-line applications', estimatedMinutes: 180, artwork: 'terminal',
  description: 'Build a complete command-line task manager with durable storage and resilient input handling.',
  supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
  whatYouWillBuild: 'A terminal application that adds, lists, completes, deletes, saves, and reloads tasks while handling invalid input safely.',
  learningObjectives: ['Structure a multi-step program.', 'Model values idiomatically.', 'Apply collections and control flow.', 'Read terminal input safely.', 'Serialize and restore state.', 'Debug a complete CLI workflow.'],
  prerequisites: ['Variables and functions', 'Collections', 'Conditionals and loops', 'Basic syntax in the selected language'],
  skills: ['Program structure', 'Data modeling', 'CLI input', 'CRUD operations', 'File persistence', 'Error handling'],
  guide: [{ type: 'paragraph', text: 'Build one verified capability at a time. Concepts remain shared while examples and runtime details adapt to the selected language.' }, command],
  languageContent,
  languageOverrides: { javascript: { entrypoint: 'index.js', runCommand: 'node index.js' } },
  checkpoints: [
    { id: 'setup', title: 'Project Setup', objective: 'Create the base application and run it successfully.', executionMode: 'run_or_terminal', expectedOutput: 'Task Manager', validation: validation(execute('starts', 'Application starts', ['Task Manager'])), requirements: ['Keep the configured entrypoint.', 'Display a Task Manager welcome message.', 'Run using Run or the terminal command.'], completionMessage: 'The Task Manager starts successfully.', guide: [{ type: 'heading', text: 'Start with the smallest runnable program' }, { type: 'paragraph', text: 'Find the configured entrypoint. Keep the first version small so environment problems remain separate from application problems.' }, { type: 'note', text: 'Print a welcome message containing “Task Manager”. The menu comes later.' }, command, { type: 'expected-output', text: 'Task Manager' }] },
    { id: 'task-model', title: 'Task Representation', objective: 'Represent a task without tying the design to one language feature.', executionMode: 'run_or_terminal', validation: representations, requirements: ['Store a title.', 'Store completion state.', 'Create and use a task value.'], completionMessage: 'The application has a usable task representation.', guide: [{ type: 'heading', text: 'Model the information before the menu' }, { type: 'paragraph', text: 'Each task needs a title and a completion state. Choose a representation that keeps those values together.' }, { type: 'paragraph', text: 'Create one example task and inspect or print its state before adding operations.' }, hint('taskModelHint'), snippet('taskModelCode'), command] },
    { id: 'operations', title: 'Task Operations', objective: 'Implement add, list, complete, and delete behavior.', executionMode: 'terminal_only', validation: operations, requirements: ['Use menu choices 1–5 as shown in the guide.', 'Add tasks.', 'List tasks.', 'Complete a selected task.', 'Delete a selected task.', 'Run from the terminal.'], completionMessage: 'All four task operations are implemented.', guide: [{ type: 'heading', text: 'Separate operations from presentation' }, { type: 'paragraph', text: 'Keep the task collection as the source of truth. Each operation changes or reads it; the CLI only decides which operation to call.' }, { type: 'list', items: ['Use choices 1–5 for add, list, complete, delete, and exit.', 'Add a non-empty title.', 'List tasks with a stable number and completion marker.', 'Complete a selected task.', 'Delete a selected task safely.'] }, snippet('inputCode'), { type: 'note', text: 'This checkpoint intentionally practices terminal commands. Run is disabled.' }, command, { type: 'expected-output', text: '1. Add Task\n2. List Tasks\n3. Complete Task\n4. Delete Task\n5. Exit' }] },
    { id: 'storage', title: 'Persistent Storage', objective: 'Save task state and restore it at startup.', executionMode: 'run_or_terminal', validation: persistence, requirements: ['Save task data.', 'Load task data.', 'Handle a missing file safely.', 'Verify a restart workflow.'], completionMessage: 'Task state is saved and restored.', guide: [{ type: 'heading', text: 'Turn memory into durable state' }, { type: 'paragraph', text: 'Serialization converts task values into data that can be written to a file; deserialization rebuilds them at startup.' }, { type: 'list', items: ['Load during startup.', 'Treat a missing file as an empty list.', 'Save after every mutation.', 'Recover safely from unreadable data.'] }, hint('persistenceHint'), snippet('persistenceCode'), { type: 'note', text: 'Create a task, exit, start again, and verify it reloads.' }, command] },
    { id: 'integration', title: 'Final CLI Integration', objective: 'Connect the model, operations, persistence, and command loop.', executionMode: 'terminal_only', validation: finalValidation, requirements: ['Show a repeating menu.', 'Support all four operations.', 'Persist mutations.', 'Handle invalid input.', 'Exit cleanly.', 'Run the workflow from the terminal.'], completionMessage: 'The production CLI Task Manager is complete.', guide: [{ type: 'heading', text: 'Build a predictable command loop' }, { type: 'paragraph', text: 'A CLI shows actions, reads a choice, and dispatches an operation. Invalid input returns to the menu rather than ending the program.' }, snippet('inputCode'), { type: 'list', items: ['Display the menu.', 'Connect every operation.', 'Save and reload task state.', 'Handle invalid choices.', 'Exit cleanly.'] }, { type: 'note', text: 'Try valid commands, invalid input, and a restart before validating.' }, command] },
  ],
  finalValidation,
  export: { repositoryName: 'cli-task-manager' },
};
