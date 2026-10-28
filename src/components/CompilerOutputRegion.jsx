import { DatabaseResultPanel } from './DatabaseResultPanel';
import { EmulatorResultPanel } from './EmulatorResultPanel';
import { OutputPanel } from './OutputPanel';
import { PreviewPanel } from './PreviewPanel';
import { ResizeHandle } from './ResizeHandle';

export function CompilerOutputRegion({
  compiler,
  drawer,
  execution,
  verificationStatus,
  renderOutput,
  publicTests,
  contract,
  onCheckOutput,
}) {
  const {
    preview,
    database,
    emulator,
    result,
    error,
    isRunning,
    executionTimeMs,
    executionStatus,
  } = execution;
  const canCheckOutput = executionStatus === 'success' && compiler.expectedOutput !== undefined;
  const sharedPanelProps = {
    height: drawer.renderedHeight,
    collapsed: drawer.collapsed,
    onExpand: drawer.expand,
    onToggleCollapsed: drawer.toggle,
  };

  let output;
  if (compiler.executionMode === 'preview') {
    output = <PreviewPanel preview={preview} executionStatus={executionStatus} {...sharedPanelProps} />;
  } else if (compiler.executionMode === 'database') {
    output = (
      <DatabaseResultPanel
        database={database}
        error={error}
        isRunning={isRunning}
        executionTimeMs={executionTimeMs}
        executionStatus={executionStatus}
        {...sharedPanelProps}
      />
    );
  } else if (compiler.executionMode === 'emulator') {
    output = (
      <EmulatorResultPanel
        emulator={emulator}
        result={result}
        error={error}
        isRunning={isRunning}
        executionTimeMs={executionTimeMs}
        executionStatus={executionStatus}
        {...sharedPanelProps}
      />
    );
  } else {
    output = renderOutput?.({
      ...sharedPanelProps,
      result,
      error,
      isRunning,
      executionTimeMs,
      expectedOutput: compiler.expectedOutput,
      inputs: compiler.stdin,
      executionStatus,
      verificationStatus,
      language: compiler.language,
      complexity: compiler.complexity ?? {},
      onCheckOutput,
      canCheckOutput,
    }) ?? (
      <OutputPanel
        output={compiler.output}
        result={result}
        error={error}
        isRunning={isRunning}
        executionTimeMs={executionTimeMs}
        complexity={compiler.complexity ?? {}}
        tests={publicTests}
        contract={contract}
        expectedOutput={compiler.expectedOutput}
        inputs={compiler.stdin}
        executionStatus={executionStatus}
        verificationStatus={verificationStatus}
        onCheckOutput={onCheckOutput}
        canCheckOutput={canCheckOutput}
        {...sharedPanelProps}
      />
    );
  }

  return (
    <>
      <ResizeHandle
        className="output-resize-handle"
        label={compiler.resizeLabel}
        min={drawer.min}
        max={drawer.max}
        value={drawer.collapsed ? drawer.min : drawer.value}
        orientation="horizontal"
        onPointerDown={drawer.startDragging}
        onKeyDown={(event) => {
          if (drawer.collapsed) drawer.expand();
          drawer.handleKeyDown(event);
        }}
      />
      {output}
    </>
  );
}
