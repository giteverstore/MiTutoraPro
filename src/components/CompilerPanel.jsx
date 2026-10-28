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
import { getDevelopmentCompilerOptions } from '../compiler/developmentCompilerOverride';
import { CompilerOutputRegion } from './CompilerOutputRegion';
import { useCompilerExecution } from '../compiler/useCompilerExecution';
import { useCompilerDefinitionSession } from '../compiler/useCompilerDefinitionSession';

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
  const [selectionSnapshot, setSelectionSnapshot] = useState(null);
  const selectionVersionRef = useRef(0);
  const collapsibleOutput = activityType === 'lesson' || Boolean(languageSelector);
  const outputDrawer = useCompilerBottomDrawer({ collapsible: collapsibleOutput, containerRef: panelRef });
  const expandOutputDrawer = outputDrawer.expand;

  const onSourceChanged = useCallback(() => { selectionVersionRef.current += 1; setSelectionSnapshot(null); }, []);
  const executionActionsRef = useRef(null);
  const definitionSession = useCompilerDefinitionSession({ initialCompiler: compiler, compilerManager, instanceId, executionActionsRef, onSourceChanged });
  const { activeCompiler, activeCompilerRef, code, currentCodeRef, replaceConfirmation, isDevelopmentCompilerSwitching, isDirty, setFormattedSource, handleCodeChange, resetEditor, loadDefinition: loadCompilerDefinition, selectDevelopmentCompiler, resolveReplaceConfirmation } = definitionSession;
  const execution = useCompilerExecution({ compilerManager, settings, instanceId, activeCompilerRef, currentCodeRef, onFormattedSource: setFormattedSource, expandOutput: expandOutputDrawer, verifyExercise, invalidateExerciseVerification, onVerificationChange });
  const { isRunning, result, error, executionStatus, verificationStatus, executionTimeMs, compilerEvidence, preview, database, emulator, run: showRunFeedback, checkOutput, reset: resetExecution, clearExecution, cancelExecution } = execution;
  executionActionsRef.current = { reset: resetExecution, clear: clearExecution, cancel: cancelExecution };

  useEffect(() => {
    onExecutionStateChange?.(isRunning ? 'running' : executionStatus === 'error' ? 'failed' : 'ready');
  }, [executionStatus, isRunning, onExecutionStateChange]);

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
    isDirty,
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
        onConfirm={() => resolveReplaceConfirmation(true)}
        onCancel={() => resolveReplaceConfirmation(false)}
      />
    </div>
  );
});
