import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorHeader } from './EditorHeader';
import { EditorPlaceholder } from './EditorPlaceholder';
import { OutputPanel } from './OutputPanel';
import { ResizeHandle } from './ResizeHandle';
import { useDragResize } from '../hooks/useDragResize';
import { LAYOUT_SIZE } from '../design-system/theme';
import { useCompilerAdapter } from '../compiler/CompilerProvider';

export function CompilerPanel({ compiler }) {
  const panelRef = useRef(null);
  const adapter = useCompilerAdapter();
  const [isRunning, setIsRunning] = useState(false);
  const initialCode = compiler.editor.lines.map((line) => line.text ?? '').join('\n');
  const [code, setCode] = useState(initialCode);
  const currentCodeRef = useRef(initialCode);
  const [activeTab, setActiveTab] = useState('output');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [executionTimeMs, setExecutionTimeMs] = useState(null);
  const executionControllerRef = useRef(null);
  const outputResize = useDragResize({
    ...LAYOUT_SIZE.output,
    direction: -1,
    axis: 'y',
  });

  const showRunFeedback = useCallback(async () => {
    executionControllerRef.current?.abort();
    const controller = new AbortController();
    executionControllerRef.current = controller;
    setIsRunning(true);
    setError('');
    setExecutionTimeMs(null);

    try {
      const execution = await adapter.execute({
        source: currentCodeRef.current,
        language: compiler.language,
        signal: controller.signal,
      });

      setResult(execution.output);
      setError(execution.errors.join('\n'));
      setExecutionTimeMs(execution.executionTimeMs);
      setActiveTab(execution.status === 'error' ? 'errors' : 'output');
      window.dispatchEvent(new CustomEvent('learning-platform:execution-complete', {
        detail: execution,
      }));
    } catch (executionError) {
      if (executionError.name !== 'AbortError') {
        setResult('');
        setError(executionError.message || 'The compiler adapter could not complete the request.');
        setActiveTab('errors');
      }
    } finally {
      if (executionControllerRef.current === controller) {
        executionControllerRef.current = null;
        setIsRunning(false);
      }
    }
  }, [adapter, compiler.language]);

  const handleCodeChange = useCallback((nextCode) => {
    currentCodeRef.current = nextCode;
    setCode(nextCode);
  }, []);

  const resetEditor = useCallback(async () => {
    executionControllerRef.current?.abort();
    executionControllerRef.current = null;
    await adapter.reset();
    setIsRunning(false);
    currentCodeRef.current = initialCode;
    setCode(initialCode);
    setResult('');
    setError('');
    setExecutionTimeMs(null);
    setActiveTab('output');
  }, [adapter, initialCode]);

  useEffect(() => {
    const handleKeyboardRun = () => {
      if (panelRef.current?.getClientRects().length) showRunFeedback();
    };
    window.addEventListener('learning-platform:run', handleKeyboardRun);
    return () => {
      window.removeEventListener('learning-platform:run', handleKeyboardRun);
      executionControllerRef.current?.abort();
    };
  }, [showRunFeedback]);

  return (
    <div className="compiler-panel" ref={panelRef}>
      <EditorHeader data={compiler} isRunning={isRunning} onRun={showRunFeedback} onReset={resetEditor} />
      <EditorPlaceholder editor={compiler.editor} value={code} onChange={handleCodeChange} />
      <ResizeHandle
        className="output-resize-handle"
        label={compiler.resizeLabel}
        min={LAYOUT_SIZE.output.min}
        max={LAYOUT_SIZE.output.max}
        value={outputResize.value}
        orientation="horizontal"
        onPointerDown={outputResize.startDragging}
        onKeyDown={outputResize.handleKeyDown}
      />
      <OutputPanel
        output={compiler.output}
        height={outputResize.value}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        result={result}
        error={error}
        isRunning={isRunning}
        executionTimeMs={executionTimeMs}
        expectedOutput={compiler.expectedOutput}
      />
      <div className="compiler-footer">
        {compiler.footerItems.map((item) => <span key={item}>{item}</span>)}
      </div>
    </div>
  );
}
