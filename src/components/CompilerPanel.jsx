import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { EditorHeader } from './EditorHeader';
import { EditorPlaceholder } from './EditorPlaceholder';
import { OutputPanel } from './OutputPanel';
import { ResizeHandle } from './ResizeHandle';
import { useCompilerManager } from '../compiler/CompilerProvider';
import { useOptionalLearningProgress } from '../progress/LearningProgressContext';
import { useSettings } from '../settings/useSettings';
import { COMPILER_EVENTS, createCompilerExecutionEvent } from '../compiler/core/compilerEvents';
import { ConfirmDialog } from './Dialog';
import { createSourceSnapshotHash } from '../compiler/core/sourceSnapshot';
import { useCompilerBottomDrawer } from '../compiler/useCompilerBottomDrawer';
import { normalizeEditorThemeId } from '../theme/editorThemeCatalog';

export const CompilerPanel = forwardRef(function CompilerPanel({
  compiler,
  onVerificationChange,
  onExecutionStateChange,
  renderOutput,
  instanceId: requestedInstanceId,
  activityType = 'unknown',
  languageSelector,
  isCompilerMinimized = false,
  onToggleCompiler,
  onAskAITutor,
  onContextChange,
  aiEnabled = false,
  publicTests = [],
  contract = null,
}, forwardedRef) {
  const generatedInstanceId = useId();
  const instanceId = requestedInstanceId ?? `compiler-${generatedInstanceId.replace(/:/g, '')}`;
  const panelRef = useRef(null);
  const compilerManager = useCompilerManager();
  const learningProgress = useOptionalLearningProgress();
  const settings = useSettings();
  const editorThemeId = normalizeEditorThemeId(settings.editor.theme);
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
  const [selectionSnapshot, setSelectionSnapshot] = useState(null);
  const selectionVersionRef = useRef(0);
  const [compilerEvidence, setCompilerEvidence] = useState(null);
  const [replaceConfirmation, setReplaceConfirmation] = useState(null);
  const executionControllerRef = useRef(null);
  const collapsibleOutput = activityType === 'lesson' || Boolean(languageSelector);
  const outputDrawer = useCompilerBottomDrawer({ collapsible: collapsibleOutput, containerRef: panelRef });
  const expandOutputDrawer = outputDrawer.expand;

  useEffect(() => {
    onExecutionStateChange?.(isRunning ? 'running' : executionStatus === 'error' ? 'failed' : 'ready');
  }, [executionStatus, isRunning, onExecutionStateChange]);

  const showRunFeedback = useCallback(async (executionOverride = null) => {
    expandOutputDrawer();
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
    setCompilerEvidence(null);

    try {
      let source = requestedSource;
      if (settings.editor.autoFormatOnRun) {
        source = await compilerManager.format({
          language: definition.language,
          source,
          instanceId,
        });
        currentCodeRef.current = source;
        setCode(source);
      }
      const execution = await compilerManager.execute({
        source,
        language: definition.language,
        stdin: definition.stdin,
        filename: definition.editor.fileName,
        execution: definition.execution,
        timeoutMs: definition.timeoutMs,
        signal: controller.signal,
        instanceId,
      });

      setResult(execution.output);
      setError(execution.errors.join('\n'));
      setExecutionTimeMs(execution.executionTimeMs);
      setExecutionStatus(execution.status);
      try {
        setCompilerEvidence(Object.freeze({
          source,
          sourceHash: await createSourceSnapshotHash(source),
          language: definition.language,
          status: execution.status,
          output: execution.errors.length ? execution.errors.join('\n') : execution.output,
        }));
      } catch {
        setCompilerEvidence(null);
      }
      window.dispatchEvent(createCompilerExecutionEvent(instanceId, execution, {
        language: definition.language,
      }));
    } catch (executionError) {
      if (executionError.name !== 'AbortError') {
        setResult('');
        setError(executionError.message || 'The compiler adapter could not complete the request.');
        setExecutionStatus('error');
        setCompilerEvidence(null);
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
    instanceId,
    expandOutputDrawer,
  ]);

  const handleCodeChange = useCallback((nextCode) => {
    currentCodeRef.current = nextCode;
    selectionVersionRef.current += 1;
    setCode(nextCode);
    setResult('');
    setError('');
    setExecutionStatus('idle');
    setSelectionSnapshot(null);
    setVerificationStatus('idle');
    setExecutionTimeMs(null);
    setCompilerEvidence(null);
    const definition = activeCompilerRef.current;
    if (definition.exerciseId) invalidateExerciseVerification?.(definition.exerciseId);
    onVerificationChange?.('idle');
  }, [invalidateExerciseVerification, onVerificationChange]);

  const handleSelectionChange = useCallback(async (selection) => {
    const version = selectionVersionRef.current + 1;
    selectionVersionRef.current = version;
    if (!selection?.text?.trim()) { setSelectionSnapshot(null); return; }
    const sourceHash = await createSourceSnapshotHash(selection.source);
    const selectionHash = await createSourceSnapshotHash(selection.text);
    if (selectionVersionRef.current !== version || currentCodeRef.current !== selection.source) return;
    setSelectionSnapshot(Object.freeze({
      text: selection.text,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      sourceHash,
      selectionHash,
      language: activeCompilerRef.current.language,
    }));
  }, []);

  const handleAskSelection = useCallback(async (selection) => {
    if (!selection?.text?.trim()) return;
    const sourceHash = await createSourceSnapshotHash(selection.source);
    const selectionHash = await createSourceSnapshotHash(selection.text);
    if (currentCodeRef.current !== selection.source) return;
    const snapshot = Object.freeze({
      text: selection.text,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      sourceHash,
      selectionHash,
      language: activeCompilerRef.current.language,
      startLine: selection.startLine,
      endLine: selection.endLine,
      surroundingCode: selection.surroundingCode,
    });
    setSelectionSnapshot(snapshot);
    onAskAITutor?.({
      code: selection.source,
      language: activeCompilerRef.current.language,
      fileName: activeCompilerRef.current.editor.fileName,
      selectionContext: { text: selection.text, snapshot },
    });
  }, [onAskAITutor]);

  useEffect(() => {
    onContextChange?.({
      code,
      language: activeCompiler.language,
      fileName: activeCompiler.editor.fileName,
      selectionSnapshot,
      compilerEvidence,
      compilerStatus: isRunning ? 'running' : executionStatus,
    });
  }, [activeCompiler.editor.fileName, activeCompiler.language, code, compilerEvidence, executionStatus, isRunning, onContextChange, selectionSnapshot]);

  const checkOutput = useCallback(() => {
    expandOutputDrawer();
    if (executionStatus !== 'success') return;
    const definition = activeCompilerRef.current;
    const matches = compilerManager.validateOutput({
      expectedOutput: definition.expectedOutput,
      programOutput: result,
      validatorType: definition.validatorType,
      validatorOptions: definition.validatorOptions,
    });
    setVerificationStatus(matches ? 'matched' : 'mismatched');
    onVerificationChange?.(matches ? 'matched' : 'mismatched');
    if (matches && definition.exerciseId) {
      verifyExercise?.(definition.exerciseId, {
        expectedOutput: definition.expectedOutput,
        programOutput: result,
        sourceCode: currentCodeRef.current,
        compilerId: definition.id,
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
    expandOutputDrawer,
  ]);

  const resetEditor = useCallback(async () => {
    executionControllerRef.current?.abort();
    executionControllerRef.current = null;
    const definition = activeCompilerRef.current;
    await compilerManager.reset(definition.language, instanceId);
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
    setSelectionSnapshot(null);
    setCompilerEvidence(null);
  }, [
    compilerManager,
    initialCode,
    invalidateExerciseVerification,
    onVerificationChange,
    instanceId,
  ]);

  const applyCompilerDefinition = useCallback((definition) => {
    const source = definition.editor.lines.map((line) => line.text ?? '').join('\n');
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
    setSelectionSnapshot(null);
    setCompilerEvidence(null);
    if (definition.exerciseId) invalidateExerciseVerification?.(definition.exerciseId);
    onVerificationChange?.('idle');
    return true;
  }, [invalidateExerciseVerification, onVerificationChange]);

  const requestReplaceConfirmation = useCallback((description, confirmLabel) => new Promise((resolve) => {
    setReplaceConfirmation({ resolve, description, confirmLabel });
  }), []);

  const loadCompilerDefinition = useCallback(async (definition, { confirmReplace = true, replacementDescription, replacementConfirmLabel } = {}) => {
    const source = definition.editor.lines.map((line) => line.text ?? '').join('\n');
    const hasLearnerEdits = currentCodeRef.current !== lastLoadedCodeRef.current;
    if (hasLearnerEdits && source !== currentCodeRef.current && confirmReplace) {
      const accepted = await requestReplaceConfirmation(replacementDescription, replacementConfirmLabel);
      if (!accepted) return false;
    }
    return applyCompilerDefinition(definition);
  }, [applyCompilerDefinition, requestReplaceConfirmation]);

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
      if (!await loadCompilerDefinition(definition)) return false;
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      await showRunFeedback({ source, compiler: definition });
      return true;
    },
  }), [loadCompilerDefinition, showRunFeedback]);

  useEffect(() => {
    const handleKeyboardRun = (event) => {
      if (event.detail?.instanceId === instanceId && panelRef.current?.getClientRects().length) {
        showRunFeedback();
      }
    };
    window.addEventListener(COMPILER_EVENTS.run, handleKeyboardRun);
    return () => window.removeEventListener(COMPILER_EVENTS.run, handleKeyboardRun);
  }, [instanceId, showRunFeedback]);

  useEffect(() => () => executionControllerRef.current?.abort(), []);

  return (
    <div className="compiler-panel" ref={panelRef} data-compiler-instance-id={instanceId}>
      <div className="compiler-ide" data-editor-theme={editorThemeId}>
        <EditorHeader
          data={activeCompiler}
          isRunning={isRunning}
          executionStatus={executionStatus}
          verificationStatus={verificationStatus}
          onRun={showRunFeedback}
          onReset={resetEditor}
          languageSelector={languageSelector}
          isCompilerMinimized={isCompilerMinimized}
          onToggleCompiler={onToggleCompiler}
        />
        <div className="compiler-workspace compiler-workspace-editor-only">
          <div className="compiler-main-row">
            <div className="compiler-main-view compiler-editor-view">
              <EditorPlaceholder editor={activeCompiler.editor} value={code} onChange={handleCodeChange} onSelectionChange={handleSelectionChange} onAskSelection={aiEnabled ? handleAskSelection : undefined} instanceId={instanceId} />
            </div>
          </div>
        </div>
        <ResizeHandle
          className="output-resize-handle"
          label={activeCompiler.resizeLabel}
          min={outputDrawer.min}
          max={outputDrawer.max}
          value={outputDrawer.collapsed ? outputDrawer.min : outputDrawer.value}
          orientation="horizontal"
          onPointerDown={outputDrawer.startDragging}
          onKeyDown={(event) => {
            if (outputDrawer.collapsed) outputDrawer.expand();
            outputDrawer.handleKeyDown(event);
          }}
        />
        {renderOutput?.({
          height: outputDrawer.renderedHeight,
          collapsed: outputDrawer.collapsed,
          onExpand: expandOutputDrawer,
          onToggleCollapsed: outputDrawer.toggle,
          result,
          error,
          isRunning,
          executionTimeMs,
          expectedOutput: activeCompiler.expectedOutput,
          inputs: activeCompiler.stdin,
          executionStatus,
          verificationStatus,
          language: activeCompiler.language,
          complexity: activeCompiler.complexity ?? {},
          onCheckOutput: checkOutput,
          canCheckOutput: executionStatus === 'success' && activeCompiler.expectedOutput !== undefined,
        }) ?? (
          <OutputPanel
            output={activeCompiler.output}
            height={outputDrawer.renderedHeight}
            collapsed={outputDrawer.collapsed}
            onExpand={expandOutputDrawer}
            onToggleCollapsed={outputDrawer.toggle}
            result={result}
            error={error}
            isRunning={isRunning}
            executionTimeMs={executionTimeMs}
            complexity={activeCompiler.complexity ?? {}}
            tests={publicTests}
            contract={contract}
            expectedOutput={activeCompiler.expectedOutput}
            inputs={activeCompiler.stdin}
            executionStatus={executionStatus}
            verificationStatus={verificationStatus}
            onCheckOutput={checkOutput}
            canCheckOutput={executionStatus === 'success' && activeCompiler.expectedOutput !== undefined}
          />
        )}
      </div>
      <ConfirmDialog
        open={Boolean(replaceConfirmation)}
        title="Replace current code?"
        description={replaceConfirmation?.description ?? 'Your current editor changes will be replaced.'}
        confirmLabel={replaceConfirmation?.confirmLabel ?? 'Replace code'}
        onConfirm={() => { replaceConfirmation?.resolve(true); setReplaceConfirmation(null); }}
        onCancel={() => { replaceConfirmation?.resolve(false); setReplaceConfirmation(null); }}
      />
    </div>
  );
});
