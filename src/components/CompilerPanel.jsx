import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorHeader } from './EditorHeader';
import { EditorPlaceholder } from './EditorPlaceholder';
import { OutputPanel } from './OutputPanel';
import { ResizeHandle } from './ResizeHandle';
import { useDragResize } from '../hooks/useDragResize';
import { LAYOUT_SIZE } from '../design-system/theme';
import { useCompilerManager } from '../compiler/CompilerProvider';
import { useLearningProgress } from '../progress/LearningProgressContext';

export function CompilerPanel({ compiler }) {
  const panelRef = useRef(null);
  const compilerManager = useCompilerManager();
  const { verifyExercise, invalidateExerciseVerification } = useLearningProgress();
  const [isRunning, setIsRunning] = useState(false);
  const initialCode = compiler.editor.lines.map((line) => line.text ?? '').join('\n');
  const [code, setCode] = useState(initialCode);
  const currentCodeRef = useRef(initialCode);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [executionStatus, setExecutionStatus] = useState('idle');
  const [verificationStatus, setVerificationStatus] = useState('idle');
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
    setExecutionStatus('running');
    setVerificationStatus('idle');
    if (compiler.exerciseId) invalidateExerciseVerification(compiler.exerciseId);
    setError('');
    setExecutionTimeMs(null);

    try {
      const execution = await compilerManager.execute({
        source: currentCodeRef.current,
        language: compiler.language,
        stdin: compiler.stdin,
        filename: compiler.editor.fileName,
        signal: controller.signal,
      });

      setResult(execution.output);
      setError(execution.errors.join('\n'));
      setExecutionTimeMs(execution.executionTimeMs);
      setExecutionStatus(execution.status);
      window.dispatchEvent(new CustomEvent('learning-platform:execution-complete', {
        detail: execution,
      }));
    } catch (executionError) {
      if (executionError.name !== 'AbortError') {
        setResult('');
        setError(executionError.message || 'The compiler adapter could not complete the request.');
        setExecutionStatus('error');
      }
    } finally {
      if (executionControllerRef.current === controller) {
        executionControllerRef.current = null;
        setIsRunning(false);
      }
    }
  }, [
    compilerManager,
    compiler.exerciseId,
    compiler.stdin,
    compiler.language,
    invalidateExerciseVerification,
  ]);

  const handleCodeChange = useCallback((nextCode) => {
    currentCodeRef.current = nextCode;
    setCode(nextCode);
    setVerificationStatus('idle');
    if (compiler.exerciseId) invalidateExerciseVerification(compiler.exerciseId);
  }, [compiler.exerciseId, invalidateExerciseVerification]);

  const checkOutput = useCallback(() => {
    if (executionStatus !== 'success') return;
    const matches = compilerManager.validateOutput({
      expectedOutput: compiler.expectedOutput,
      programOutput: result,
      validatorType: compiler.validatorType,
    });
    setVerificationStatus(matches ? 'matched' : 'mismatched');
    if (matches && compiler.exerciseId) {
      verifyExercise(compiler.exerciseId, {
        expectedOutput: compiler.expectedOutput,
        programOutput: result,
      });
    } else if (compiler.exerciseId) {
      invalidateExerciseVerification(compiler.exerciseId);
    }
  }, [
    compiler.exerciseId,
    compiler.expectedOutput,
    compiler.validatorType,
    compilerManager,
    executionStatus,
    invalidateExerciseVerification,
    result,
    verifyExercise,
  ]);

  const resetEditor = useCallback(async () => {
    executionControllerRef.current?.abort();
    executionControllerRef.current = null;
    await compilerManager.reset(compiler.language);
    setIsRunning(false);
    currentCodeRef.current = initialCode;
    setCode(initialCode);
    setResult('');
    setError('');
    setExecutionStatus('idle');
    setVerificationStatus('idle');
    if (compiler.exerciseId) invalidateExerciseVerification(compiler.exerciseId);
    setExecutionTimeMs(null);
  }, [
    compiler.exerciseId,
    compiler.language,
    compilerManager,
    initialCode,
    invalidateExerciseVerification,
  ]);

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
      <div className="compiler-ide">
        <EditorHeader
          data={compiler}
          isRunning={isRunning}
          executionStatus={executionStatus}
          verificationStatus={verificationStatus}
          onRun={showRunFeedback}
          onReset={resetEditor}
        />
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
          result={result}
          error={error}
          isRunning={isRunning}
          executionTimeMs={executionTimeMs}
          expectedOutput={compiler.expectedOutput}
          inputs={compiler.stdin}
          executionStatus={executionStatus}
          verificationStatus={verificationStatus}
          onCheckOutput={checkOutput}
          canCheckOutput={executionStatus === 'success' && compiler.expectedOutput !== undefined}
        />
      </div>
    </div>
  );
}
