import { CompilerPanel } from '../CompilerPanel';
import { normalizeCompilerDefinition } from '../../compiler/core/normalizeCompilerDefinition';
import { DomainErrorBoundary } from '../../errors/ErrorBoundary';

export function createCompilerData(definition) {
  const {
    language,
    fileName,
    starterCode,
    stdin,
    expectedOutput,
    validatorType,
    validatorOptions,
    execution,
    timeoutMs,
    testCases,
  } = normalizeCompilerDefinition(definition);
  const { id, runLabel, resetLabel, compiler } = definition;
  return compiler ? { id, ...compiler } : {
    id,
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
      fileName,
      unsavedLabel: 'Unsaved changes',
      ariaLabel: `${fileName} code editor`,
      language,
      lines: starterCode.split('\n').map((text, index) => ({
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
    footerItems: [`File: ${fileName}`, `Language: ${language}`],
    starterCode,
    stdin,
    expectedOutput,
    validatorType,
    validatorOptions,
    execution,
    timeoutMs,
    testCases,
  };
}

export function CompilerBlock(props) {
  const compilerData = createCompilerData(props);
  return (
    <section className="content-section lesson-compiler-block">
      <DomainErrorBoundary
        name="lesson-compiler-block"
        title="This compiler could not be displayed."
        description="The rest of the lesson is still available. Retry this block to continue."
        resetKeys={[props.id]}
        compact
      >
        <CompilerPanel compiler={compilerData} instanceId={`block-${props.id}`} />
      </DomainErrorBoundary>
    </section>
  );
}
