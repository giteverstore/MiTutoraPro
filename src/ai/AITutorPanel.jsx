import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, LoaderCircle, RefreshCw, ScanText, Sparkles, X } from 'lucide-react';
import { aiTutorClient } from './AITutorClient';
import { AITutorResponse } from './AITutorResponse';
import { ACCESS_FEATURES, canAccessFeature } from '../access/accessPolicy';
import { useOptionalSubscriptionAccess } from '../access/SubscriptionAccessContext';
import { PremiumGate } from '../access/PremiumGate';

export function AITutorPanel({ language, code, selectedCode = '', selectionSnapshot = null, compilerEvidence, compilerStatus, lessonContext, activityType = 'unknown', titleId = 'ai-tutor-title', client = aiTutorClient, accessTier }) {
  const access = useOptionalSubscriptionAccess();
  const tier = accessTier ?? access?.tier ?? 'FREE';
  const [state, setState] = useState({ status: 'idle', response: null, responseKey: '', requestType: '', stale: false, error: '', errorCode: '', retryable: false });
  const requestRef = useRef(null);
  const activeSelection = selectionSnapshot?.text ?? selectedCode;
  const hasSelection = Boolean(activeSelection?.trim() && selectionSnapshot);
  const contextKey = useMemo(() => JSON.stringify({ language, code, selectionSnapshot, compilerEvidence, compilerStatus, lessonContext, activityType }), [language, code, selectionSnapshot, compilerEvidence, compilerStatus, lessonContext, activityType]);
  const contextKeyRef = useRef(contextKey);
  contextKeyRef.current = contextKey;
  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (requestRef.current && requestRef.current.contextKey !== contextKey) {
      requestRef.current.controller.abort();
      requestRef.current = null;
    }
    setState((current) => {
      if (!current.response) return current.status === 'loading' ? { ...current, status: 'idle', error: '' } : current;
      if (current.responseKey === contextKey) return current;
      return { ...current, status: 'success', stale: true, error: '' };
    });
  }, [contextKey]);

  const explain = async (requestType) => {
    requestRef.current?.controller.abort();
    const controller = new AbortController();
    const request = { controller, contextKey };
    requestRef.current = request;
    setState((current) => ({ ...current, status: 'loading', requestType, error: '', errorCode: '', retryable: false }));
    try {
      const response = await client.explain({ requestType, language, code, selectedCode: requestType === 'explain-selection' ? activeSelection : '', selectionSnapshot: requestType === 'explain-selection' ? selectionSnapshot : undefined, compilerEvidence, compilerStatus, lessonContext, activityType }, { signal: controller.signal });
      if (requestRef.current === request && contextKeyRef.current === contextKey) {
        setState({ status: 'success', response, responseKey: contextKey, requestType, stale: false, error: '', errorCode: '', retryable: false });
      }
    } catch (error) {
      if (error.name !== 'AbortError' && requestRef.current === request) setState((current) => ({
        ...current,
        status: error.code === 'ai/disabled' ? 'unavailable' : 'error',
        error: error.message || 'The AI Tutor is unavailable.',
        errorCode: error.code || 'ai/unavailable',
        retryable: error.retryable === true,
      }));
    } finally {
      if (requestRef.current === request) requestRef.current = null;
    }
  };

  const cancel = () => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
    setState((current) => ({ ...current, status: current.response ? 'success' : 'idle', error: '', errorCode: '' }));
  };

  const loading = state.status === 'loading';
  const unavailable = state.status === 'unavailable';
  if (!canAccessFeature({ tier, feature: ACCESS_FEATURES.AI_TUTOR })) return <PremiumGate context="AI Tutor" />;
  return (
    <aside className="ai-tutor-panel" aria-labelledby={titleId}>
      <header className="ai-tutor-header"><span className="ai-tutor-icon" aria-hidden="true"><Bot /></span><div><strong id={titleId}>AI Tutor</strong><small>Code explanation</small></div></header>
      <details className="ai-tutor-disclosure">
        <summary>External AI receives relevant code and may be incorrect</summary>
        <p>When you request an explanation, MiTutora sends the selected or full code, programming language, activity title, and available compiler status and output to the configured AI provider. Remove secrets or personal information before continuing, and verify important guidance.</p>
      </details>
      <div className="ai-tutor-actions">
        <span className="sr-only" id={`${titleId}-selection-help`}>{hasSelection ? 'The current editor selection will be explained.' : 'Select code in the editor first.'}</span>
        <button type="button" disabled={!hasSelection || loading || unavailable} aria-describedby={`${titleId}-selection-help`} onClick={() => explain('explain-selection')} title={hasSelection ? 'Explain selected code' : 'Select code in the editor first'}><ScanText aria-hidden="true" /> Explain selection</button>
        <button type="button" disabled={!code?.trim() || loading || unavailable} onClick={() => explain('explain-full-code')}><Sparkles aria-hidden="true" /> Explain full code</button>
        {loading ? <button type="button" onClick={cancel}><X aria-hidden="true" /> Cancel explanation</button> : null}
        {!loading && state.stale && state.requestType ? <button type="button" onClick={() => explain(state.requestType)}><RefreshCw aria-hidden="true" /> Regenerate</button> : null}
        {!loading && state.status === 'error' && state.retryable && state.requestType ? <button type="button" onClick={() => explain(state.requestType)}><RefreshCw aria-hidden="true" /> Retry explanation</button> : null}
      </div>
      <span className="sr-only" role="status">{state.status === 'success' && !state.stale ? 'AI Tutor explanation ready.' : ''}</span>
      <div className="ai-tutor-response" aria-busy={loading}>
        {loading ? <div className="ai-tutor-progress" role="status"><LoaderCircle className="is-spinning" aria-hidden="true" /><span>Explaining your code…</span></div> : null}
        {!loading && state.status === 'idle' && !state.response ? <div className="ai-tutor-state"><Sparkles aria-hidden="true" /><span>Select code or ask AI to explain your program.</span></div> : null}
        {state.error ? <div className="ai-tutor-error" role="alert" aria-live="assertive">{state.error}</div> : null}
        {state.response ? <AITutorResponse response={state.response} stale={state.stale} /> : null}
      </div>
    </aside>
  );
}
