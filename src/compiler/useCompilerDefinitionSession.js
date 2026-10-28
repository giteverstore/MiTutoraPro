import { useCallback, useRef, useState } from 'react';
import { createDevelopmentCompilerDefinition } from './developmentCompilerOverride';

const sourceFromDefinition = (definition) => definition.editor.lines.map((line) => line.text ?? '').join('\n');

export function useCompilerDefinitionSession({ initialCompiler, compilerManager, instanceId, executionActionsRef, onSourceChanged }) {
  const initialCode = sourceFromDefinition(initialCompiler);
  const [activeCompiler, setActiveCompiler] = useState(initialCompiler);
  const [code, setCode] = useState(initialCode);
  const [replaceConfirmation, setReplaceConfirmation] = useState(null);
  const [isDevelopmentCompilerSwitching, setIsDevelopmentCompilerSwitching] = useState(false);
  const currentCodeRef = useRef(initialCode);
  const lastLoadedCodeRef = useRef(initialCode);
  const activeCompilerRef = useRef(initialCompiler);

  const setFormattedSource = useCallback((source) => {
    currentCodeRef.current = source;
    setCode(source);
  }, []);

  const handleCodeChange = useCallback((nextCode) => {
    currentCodeRef.current = nextCode;
    setCode(nextCode);
    executionActionsRef.current.clear(activeCompilerRef.current);
    onSourceChanged();
  }, [executionActionsRef, onSourceChanged]);

  const resetEditor = useCallback(async () => {
    const definition = activeCompilerRef.current;
    const resetSource = sourceFromDefinition(definition);
    await executionActionsRef.current.reset(definition, () => {
      currentCodeRef.current = resetSource;
      lastLoadedCodeRef.current = resetSource;
      setCode(resetSource);
      onSourceChanged();
    });
  }, [executionActionsRef, onSourceChanged]);

  const applyDefinition = useCallback((definition) => {
    const source = sourceFromDefinition(definition);
    executionActionsRef.current.cancel();
    activeCompilerRef.current = definition;
    setActiveCompiler(definition);
    currentCodeRef.current = source;
    lastLoadedCodeRef.current = source;
    setCode(source);
    executionActionsRef.current.clear(definition);
    onSourceChanged();
    return true;
  }, [executionActionsRef, onSourceChanged]);

  const requestReplaceConfirmation = useCallback((description, confirmLabel) => new Promise((resolve) => {
    setReplaceConfirmation({ resolve, description, confirmLabel });
  }), []);

  const loadDefinition = useCallback(async (definition, { confirmReplace = true, replacementDescription, replacementConfirmLabel } = {}) => {
    const source = sourceFromDefinition(definition);
    const hasLearnerEdits = currentCodeRef.current !== lastLoadedCodeRef.current;
    if (hasLearnerEdits && source !== currentCodeRef.current && confirmReplace) {
      const accepted = await requestReplaceConfirmation(replacementDescription, replacementConfirmLabel);
      if (!accepted) return false;
    }
    return applyDefinition(definition);
  }, [applyDefinition, requestReplaceConfirmation]);

  const resolveReplaceConfirmation = useCallback((accepted) => {
    replaceConfirmation?.resolve(accepted);
    setReplaceConfirmation(null);
  }, [replaceConfirmation]);

  const selectDevelopmentCompiler = useCallback(async (nextLanguage) => {
    if (!import.meta.env.DEV || nextLanguage === activeCompilerRef.current.language) return;
    const definition = createDevelopmentCompilerDefinition(activeCompilerRef.current, nextLanguage, currentCodeRef.current);
    if (!definition) return;
    setIsDevelopmentCompilerSwitching(true);
    try {
      await compilerManager.reset(activeCompilerRef.current.language, instanceId);
      applyDefinition(definition);
    } finally {
      setIsDevelopmentCompilerSwitching(false);
    }
  }, [applyDefinition, compilerManager, instanceId]);

  return {
    activeCompiler,
    activeCompilerRef,
    code,
    currentCodeRef,
    replaceConfirmation,
    isDevelopmentCompilerSwitching,
    isDirty: () => currentCodeRef.current !== lastLoadedCodeRef.current,
    setFormattedSource,
    handleCodeChange,
    resetEditor,
    loadDefinition,
    selectDevelopmentCompiler,
    resolveReplaceConfirmation,
  };
}
