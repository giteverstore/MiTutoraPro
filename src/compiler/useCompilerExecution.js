import { useCallback, useEffect, useRef, useState } from 'react';
import { createCompilerExecutionEvent } from './core/compilerEvents';
import { createSourceSnapshotHash } from './core/sourceSnapshot';

export function useCompilerExecution({ compilerManager, settings, instanceId, activeCompilerRef, currentCodeRef, onFormattedSource, expandOutput, verifyExercise, invalidateExerciseVerification, onVerificationChange }) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [executionStatus, setExecutionStatus] = useState('idle');
  const [verificationStatus, setVerificationStatus] = useState('idle');
  const [executionTimeMs, setExecutionTimeMs] = useState(null);
  const [compilerEvidence, setCompilerEvidence] = useState(null);
  const [preview, setPreview] = useState(null);
  const [database, setDatabase] = useState(null);
  const [emulator, setEmulator] = useState(null);
  const executionControllerRef = useRef(null);

  const clearExecution = useCallback((definition = activeCompilerRef.current) => {
    setResult(''); setError(''); setExecutionStatus('idle'); setVerificationStatus('idle');
    setExecutionTimeMs(null); setCompilerEvidence(null); setPreview(null); setDatabase(null); setEmulator(null);
    if (definition.exerciseId) invalidateExerciseVerification?.(definition.exerciseId);
    onVerificationChange?.('idle');
  }, [activeCompilerRef, invalidateExerciseVerification, onVerificationChange]);

  const cancelExecution = useCallback(() => {
    executionControllerRef.current?.abort();
    executionControllerRef.current = null;
  }, []);

  const run = useCallback(async (executionOverride = null) => {
    if ((executionOverride?.compiler ?? activeCompilerRef.current).runtimeAvailable === false) return;
    expandOutput();
    const definition = executionOverride?.compiler ?? activeCompilerRef.current;
    const requestedSource = executionOverride?.source ?? currentCodeRef.current;
    cancelExecution();
    const controller = new AbortController();
    executionControllerRef.current = controller;
    setIsRunning(true); setExecutionStatus('running'); setVerificationStatus('idle');
    if (definition.exerciseId) invalidateExerciseVerification?.(definition.exerciseId);
    onVerificationChange?.('idle');
    setError(''); setExecutionTimeMs(null); setCompilerEvidence(null); setEmulator(null);

    try {
      let source = requestedSource;
      if (settings.editor.autoFormatOnRun) {
        source = await compilerManager.format({ language: definition.language, source, instanceId });
        onFormattedSource(source);
      }
      const execution = await compilerManager.execute({
        source, language: definition.language, stdin: definition.stdin, filename: definition.editor.fileName,
        execution: definition.execution, setupSql: definition.setupSql, timeoutMs: definition.timeoutMs,
        signal: controller.signal, instanceId,
      });
      setResult(execution.output); setError(execution.errors.join('\n')); setExecutionTimeMs(execution.executionTimeMs);
      setExecutionStatus(execution.status); setPreview(execution.preview ?? null); setDatabase(execution.database ?? null); setEmulator(execution.emulator ?? null);
      try {
        setCompilerEvidence(Object.freeze({
          source, sourceHash: await createSourceSnapshotHash(source), language: definition.language, status: execution.status,
          output: execution.errors.length ? execution.errors.join('\n') : execution.output,
          stdout: execution.stdout ?? execution.output ?? '', stderr: execution.stderr ?? '', exitCode: execution.exitCode ?? null,
          diagnostics: execution.diagnostics ?? [], warnings: execution.warnings ?? [], compileTimeMs: execution.compileTimeMs ?? null,
          executionTimeMs: execution.executionTimeMs ?? null, database: execution.database ?? null, emulator: execution.emulator ?? null,
        }));
      } catch { setCompilerEvidence(null); }
      window.dispatchEvent(createCompilerExecutionEvent(instanceId, execution, { language: definition.language }));
    } catch (executionError) {
      if (executionError.name !== 'AbortError') {
        setResult(''); setError(executionError.message || 'The compiler adapter could not complete the request.');
        setExecutionStatus('error'); setCompilerEvidence(null); setPreview(null); setDatabase(null); setEmulator(null);
      }
    } finally {
      if (executionControllerRef.current === controller) { executionControllerRef.current = null; setIsRunning(false); }
    }
  }, [activeCompilerRef, cancelExecution, compilerManager, currentCodeRef, expandOutput, instanceId, invalidateExerciseVerification, onFormattedSource, onVerificationChange, settings.editor.autoFormatOnRun]);

  const checkOutput = useCallback(() => {
    expandOutput();
    if (executionStatus !== 'success') return;
    const definition = activeCompilerRef.current;
    const matches = compilerManager.validateOutput({ expectedOutput: definition.expectedOutput, programOutput: result, validatorType: definition.validatorType, validatorOptions: definition.validatorOptions });
    setVerificationStatus(matches ? 'matched' : 'mismatched');
    onVerificationChange?.(matches ? 'matched' : 'mismatched');
    if (matches && definition.exerciseId) verifyExercise?.(definition.exerciseId, { expectedOutput: definition.expectedOutput, programOutput: result, sourceCode: currentCodeRef.current, compilerId: definition.id });
    else if (definition.exerciseId) invalidateExerciseVerification?.(definition.exerciseId);
  }, [activeCompilerRef, compilerManager, currentCodeRef, executionStatus, expandOutput, invalidateExerciseVerification, onVerificationChange, result, verifyExercise]);

  const reset = useCallback(async (definition, onResetSource) => {
    cancelExecution();
    if (definition.runtimeAvailable !== false) await compilerManager.reset(definition.language, instanceId);
    setIsRunning(false);
    onResetSource();
    clearExecution(definition);
  }, [cancelExecution, clearExecution, compilerManager, instanceId]);

  useEffect(() => () => executionControllerRef.current?.abort(), []);

  return { isRunning, result, error, executionStatus, verificationStatus, executionTimeMs, compilerEvidence, preview, database, emulator, run, checkOutput, reset, clearExecution, cancelExecution };
}
