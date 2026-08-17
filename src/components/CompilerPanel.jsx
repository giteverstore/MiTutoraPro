import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorHeader } from './EditorHeader';
import { EditorPlaceholder } from './EditorPlaceholder';
import { OutputPanel } from './OutputPanel';
import { ResizeHandle } from './ResizeHandle';
import { useDragResize } from '../hooks/useDragResize';
import { LAYOUT_SIZE } from '../design-system/theme';
import { useCompilerManager } from '../compiler/CompilerProvider';
import { useOptionalLearningProgress } from '../progress/LearningProgressContext';
import { useSettings } from '../settings/useSettings';

export const CompilerPanel = forwardRef(function CompilerPanel({
  compiler,
  onVerificationChange,
  onExecutionStateChange,
}, forwardedRef) {
  const panelRef = useRef(null);
  const compilerManager = useCompilerManager();
  const learningProgress = useOptionalLearningProgress();
  const settings = useSettings();
  const verifyExercise = learningProgress?.verifyExercise;
  const invalidateExerciseVerification = learningProgress?.invalidateExerciseVerification;
  const [isRunning, setIsRunning] = useState(false);
  const [activeCompiler, setActiveCompiler] = useState(compiler);
  const initialCode = activeCompiler.editor.lines.map((line) => line.text ?? '').join('\n');
  const [code, setCode] = useState(initialCode);
  const currentCodeRef = useRef(initialCode);
  const lastLoadedCodeRef = useRef(initialCode);
  const activeCompilerRef = useRef(activeCompiler);
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

  useEffect(() => {
    onExecutionStateChange?.(isRunning ? 'running' : executionStatus === 'error' ? 'failed' : 'ready');
  }, [executionStatus, isRunning, onExecutionStateChange]);

  const showRunFeedback = useCallback(async (executionOverride = null) => {
    const definition = executionOverride?.compiler ?? activeCompilerRef.current;
    const requestedSource = executionOverride?.source ?? currentCodeRef.current;
    executionControllerRef.current?.abort();
    const controller = new AbortController();
    executionControllerRef.current = controller;
    setIsRunning(true);
    setExecutionStatus('running');
    setVerificationStatus('idle');
    if (definition.exerciseId) invalidateExerciseVerification?.(definition.exerciseId);
    onVerificationChange?.('idle');
    setError('');
    setExecutionTimeMs(null);

    try {
      let source = requestedSource;
      if (settings.editor.autoFormatOnRun) {
        source = await compilerManager.format({
          language: definition.language,
          source,
        });
        currentCodeRef.current = source;
        setCode(source);
      }
      const execution = await compilerManager.execute({
        source,
        language: definition.language,
        stdin: definition.stdin,
        filename: definition.editor.fileName,
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
    invalidateExerciseVerification,
    onVerificationChange,
    settings.editor.autoFormatOnRun,
  ]);

  const handleCodeChange = useCallback((nextCode) => {
    currentCodeRef.current = nextCode;
    setCode(nextCode);
    setVerificationStatus('idle');
    const definition = activeCompilerRef.current;
    if (definition.exerciseId) invalidateExerciseVerification?.(definition.exerciseId);
    onVerificationChange?.('idle');
  }, [invalidateExerciseVerification, onVerificationChange]);

  const checkOutput = useCallback(() => {
    if (executionStatus !== 'success') return;
    const definition = activeCompilerRef.current;
    const matches = compilerManager.validateOutput({
      expectedOutput: definition.expectedOutput,
      programOutput: result,
      validatorType: definition.validatorType,
    });
    setVerificationStatus(matches ? 'matched' : 'mismatched');
    onVerificationChange?.(matches ? 'matched' : 'mismatched');
    if (matches && definition.exerciseId) {
      verifyExercise?.(definition.exerciseId, {
        expectedOutput: definition.expectedOutput,
        programOutput: result,
      });
    } else if (definition.exerciseId) {
      invalidateExerciseVerification?.(definition.exerciseId);
    }
  }, [
    compilerManager,
    executionStatus,
    invalidateExerciseVerification,
    result,
    verifyExercise,
    onVerificationChange,
  ]);

  const resetEditor = useCallback(async () => {
    executionControllerRef.current?.abort();
    executionControllerRef.current = null;
    const definition = activeCompilerRef.current;
    await compilerManager.reset(definition.language);
    setIsRunning(false);
    currentCodeRef.current = initialCode;
    lastLoadedCodeRef.current = initialCode;
    setCode(initialCode);
    setResult('');
    setError('');
    setExecutionStatus('idle');
    setVerificationStatus('idle');
    if (definition.exerciseId) invalidateExerciseVerification?.(definition.exerciseId);
    onVerificationChange?.('idle');
    setExecutionTimeMs(null);
  }, [
    compilerManager,
    initialCode,
    invalidateExerciseVerification,
    onVerificationChange,
  ]);

  const loadCompilerDefinition = useCallback((definition, { confirmReplace = true } = {}) => {
    const source = definition.editor.lines.map((line) => line.text ?? '').join('\n');
    const hasLearnerEdits = currentCodeRef.current !== lastLoadedCodeRef.current;
    if (hasLearnerEdits && source !== currentCodeRef.current && confirmReplace
      && !window.confirm('Replace the current code with this example?')) {
      return false;
    }
    executionControllerRef.current?.abort();
    activeCompilerRef.current = definition;
    setActiveCompiler(definition);
    currentCodeRef.current = source;
    lastLoadedCodeRef.current = source;
    setCode(source);
    setResult('');
    setError('');
    setExecutionStatus('idle');
    setVerificationStatus('idle');
    setExecutionTimeMs(null);
    return true;
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    isDirty: () => currentCodeRef.current !== lastLoadedCodeRef.current,
    loadDefinition: (definition, options) => loadCompilerDefinition(definition, options),
    loadExample: async ({ source, language, filename = 'main.py', stdin = '' }) => {
      const base = activeCompilerRef.current;
      const definition = {
        ...base,
        language,
        exerciseId: null,
        stdin,
        expectedOutput: undefined,
        editor: {
          ...base.editor,
          fileName: filename,
          ariaLabel: `${filename} code editor`,
          lines: source.split('\n').map((text, index) => ({ number: index + 1, text, tone: 'source' })),
        },
      };
      if (!loadCompilerDefinition(definition)) return false;
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      await showRunFeedback({ source, compiler: definition });
      return true;
    },
  }), [loadCompilerDefinition, showRunFeedback]);

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
          data={activeCompiler}
          isRunning={isRunning}
          executionStatus={executionStatus}
          verificationStatus={verificationStatus}
          onRun={showRunFeedback}
          onReset={resetEditor}
        />
        <EditorPlaceholder editor={activeCompiler.editor} value={code} onChange={handleCodeChange} />
        <ResizeHandle
          className="output-resize-handle"
          label={activeCompiler.resizeLabel}
          min={LAYOUT_SIZE.output.min}
          max={LAYOUT_SIZE.output.max}
          value={outputResize.value}
          orientation="horizontal"
          onPointerDown={outputResize.startDragging}
          onKeyDown={outputResize.handleKeyDown}
        />
        <OutputPanel
          output={activeCompiler.output}
          height={outputResize.value}
          result={result}
          error={error}
          isRunning={isRunning}
          executionTimeMs={executionTimeMs}
          expectedOutput={activeCompiler.expectedOutput}
          inputs={activeCompiler.stdin}
          executionStatus={executionStatus}
          verificationStatus={verificationStatus}
          onCheckOutput={checkOutput}
          canCheckOutput={executionStatus === 'success' && activeCompiler.expectedOutput !== undefined}
        />
      </div>
    </div>
  );
});
