import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { EditorHeader } from './EditorHeader';
import { EditorPlaceholder } from './EditorPlaceholder';
import { useCompilerManager } from '../compiler/CompilerProvider';
import { useOptionalLearningProgress } from '../progress/LearningProgressContext';
import { useSettings } from '../settings/useSettings';
import { COMPILER_EVENTS } from '../compiler/core/compilerEvents';
import { ConfirmDialog } from './Dialog';
import { createSourceSnapshotHash } from '../compiler/core/sourceSnapshot';
import { useCompilerBottomDrawer } from '../compiler/useCompilerBottomDrawer';
import { normalizeEditorThemeId } from '../theme/editorThemeCatalog';
import { CompilerLanguageSelector } from './CompilerLanguageSelector';
import { createDevelopmentCompilerDefinition, getDevelopmentCompilerOptions } from '../compiler/developmentCompilerOverride';
import { CompilerOutputRegion } from './CompilerOutputRegion';
import { useCompilerExecution } from '../compiler/useCompilerExecution';

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
  const [activeCompiler, setActiveCompiler] = useState(compiler);
  const initialCode = activeCompiler.editor.lines.map((line) => line.text ?? '').join('\n');
  const [code, setCode] = useState(initialCode);
  const currentCodeRef = useRef(initialCode);
  const lastLoadedCodeRef = useRef(initialCode);
  const activeCompilerRef = useRef(activeCompiler);
  const [selectionSnapshot, setSelectionSnapshot] = useState(null);
  const selectionVersionRef = useRef(0);
  const [replaceConfirmation, setReplaceConfirmation] = useState(null);
  const [isDevelopmentCompilerSwitching, setIsDevelopmentCompilerSwitching] = useState(false);
  const collapsibleOutput = activityType === 'lesson' || Boolean(languageSelector);
  const outputDrawer = useCompilerBottomDrawer({ collapsible: collapsibleOutput, containerRef: panelRef });
  const expandOutputDrawer = outputDrawer.expand;

  const onFormattedSource = useCallback((source) => { currentCodeRef.current = source; setCode(source); }, []);
  const execution = useCompilerExecution({ compilerManager, settings, instanceId, activeCompilerRef, currentCodeRef, onFormattedSource, expandOutput: expandOutputDrawer, verifyExercise, invalidateExerciseVerification, onVerificationChange });
  const { isRunning, result, error, executionStatus, verificationStatus, executionTimeMs, compilerEvidence, preview, database, emulator, run: showRunFeedback, checkOutput, reset: resetExecution, clearExecution, cancelExecution } = execution;

  useEffect(() => {
    onExecutionStateChange?.(isRunning ? 'running' : executionStatus === 'error' ? 'failed' : 'ready');
  }, [executionStatus, isRunning, onExecutionStateChange]);

  const handleCodeChange = useCallback((nextCode) => {
    currentCodeRef.current = nextCode;
    selectionVersionRef.current += 1;
    setCode(nextCode);
    clearExecution(activeCompilerRef.current);
    setSelectionSnapshot(null);
  }, [clearExecution]);

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

  const resetEditor = useCallback(async () => {
    const definition = activeCompilerRef.current;
    const resetSource = definition.editor.lines.map((line) => line.text ?? '').join('\n');
    await resetExecution(definition, () => {
      currentCodeRef.current = resetSource;
      lastLoadedCodeRef.current = resetSource;
      setCode(resetSource);
      setSelectionSnapshot(null);
    });
  }, [resetExecution]);

  const applyCompilerDefinition = useCallback((definition) => {
    const source = definition.editor.lines.map((line) => line.text ?? '').join('\n');
    cancelExecution();
    activeCompilerRef.current = definition;
    setActiveCompiler(definition);
    currentCodeRef.current = source;
    lastLoadedCodeRef.current = source;
    setCode(source);
    clearExecution(definition);
    setSelectionSnapshot(null);
    return true;
  }, [cancelExecution, clearExecution]);

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

  const selectDevelopmentCompiler = useCallback(async (nextLanguage) => {
    if (!import.meta.env.DEV || nextLanguage === activeCompilerRef.current.language) return;
    const definition = createDevelopmentCompilerDefinition(
      activeCompilerRef.current,
      nextLanguage,
      currentCodeRef.current,
    );
    if (!definition) return;
    setIsDevelopmentCompilerSwitching(true);
    try {
      await compilerManager.reset(activeCompilerRef.current.language, instanceId);
      applyCompilerDefinition(definition);
    } finally {
      setIsDevelopmentCompilerSwitching(false);
    }
  }, [applyCompilerDefinition, compilerManager, instanceId]);

  const effectiveLanguageSelector = import.meta.env.DEV && activityType !== 'lesson' && !languageSelector ? (
    <CompilerLanguageSelector
      label="DEV Compiler:"
      ariaLabel="Development compiler runtime"
      value={activeCompiler.language}
      options={getDevelopmentCompilerOptions()}
      disabled={isDevelopmentCompilerSwitching || isRunning}
      onChange={selectDevelopmentCompiler}
    />
  ) : languageSelector;

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
      if (event.detail?.instanceId === instanceId && panelRef.current?.getClientRects().length && activeCompilerRef.current.runtimeAvailable !== false) {
        showRunFeedback();
      }
    };
    window.addEventListener(COMPILER_EVENTS.run, handleKeyboardRun);
    return () => window.removeEventListener(COMPILER_EVENTS.run, handleKeyboardRun);
  }, [instanceId, showRunFeedback]);

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
          languageSelector={effectiveLanguageSelector}
          isCompilerMinimized={isCompilerMinimized}
          onToggleCompiler={onToggleCompiler}
          runDisabled={activeCompiler.runtimeAvailable === false}
        />
        <div className="compiler-workspace compiler-workspace-editor-only">
          <div className="compiler-main-row">
            <div className="compiler-main-view compiler-editor-view">
              <EditorPlaceholder editor={activeCompiler.editor} value={code} onChange={handleCodeChange} onSelectionChange={handleSelectionChange} onAskSelection={aiEnabled ? handleAskSelection : undefined} instanceId={instanceId} />
            </div>
          </div>
        </div>
        <CompilerOutputRegion
          compiler={activeCompiler}
          drawer={{ ...outputDrawer, expand: expandOutputDrawer }}
          execution={{ preview, database, emulator, result, error, isRunning, executionTimeMs, executionStatus }}
          verificationStatus={verificationStatus}
          renderOutput={renderOutput}
          publicTests={publicTests}
          contract={contract}
          onCheckOutput={checkOutput}
        />
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
