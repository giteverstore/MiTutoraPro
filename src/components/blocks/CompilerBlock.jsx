import { CompilerPanel } from '../CompilerPanel';

export function createCompilerData({
  language,
  files,
  activeFile,
  expectedOutput,
  runLabel,
  resetLabel,
  compiler,
}) {
  const activeDocument = files?.find((file) => file.name === activeFile);
  return compiler ?? {
    ariaLabel: `${language} practice compiler`,
    eyebrow: 'Practice workspace',
    title: 'Compiler',
    status: 'Ready',
    languageLabel: 'Language',
    language,
    resetLabel: resetLabel || 'Reset',
    runLabel: runLabel || 'Run',
    runningLabel: 'Running…',
    runShortcut: 'Ctrl + Enter',
    resizeLabel: 'Resize editor and output panels',
    editor: {
      fileName: activeFile,
      unsavedLabel: 'Unsaved changes',
      ariaLabel: `${activeFile} code editor`,
      lines: (activeDocument?.content ?? '').split('\n').map((text, index) => ({
        number: index + 1,
        text,
        tone: text.trim().startsWith('#') ? 'comment' : 'source',
      })),
    },
    output: {
      outputTabLabel: 'Output',
      errorsTabLabel: 'Errors',
      errorCount: 0,
      prompt: '>_',
      emptyTitle: 'Run code to see execution output',
      emptyDescription: 'Run the code to see the result.',
      errorTitle: 'No errors',
      errorDescription: 'Compiler errors will appear here.',
    },
    footerItems: [`File: ${activeFile}`, `Language: ${language}`],
    expectedOutput,
  };
}

export function CompilerBlock(props) {
  const compilerData = createCompilerData(props);
  return (
    <section className="content-section lesson-compiler-block">
      <CompilerPanel compiler={compilerData} />
    </section>
  );
}
