import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, RotateCcw, Send, Sparkles } from 'lucide-react';
import { ACCESS_FEATURES, canAccessFeature } from '../../access/accessPolicy';
import { PremiumGate } from '../../access/PremiumGate';
import { useOptionalSubscriptionAccess } from '../../access/SubscriptionAccessContext';
import { projectAIClient } from '../ai/ProjectAIClient';
import { createConversationRequestId } from '../../ai/conversationReconciliation';
import { AITextContent } from '../../ai/AITextContent';
import { projectProviderConversation, reconcileProjectTurns } from '../ai/projectConversation';

const emptyState = () => ({ phase: 'idle', questions: [], selected: null, followUps: [], conversation: [], error: '' });

export function ProjectContextualAIConversation({ context, client = projectAIClient, accessTier }) {
  const access = useOptionalSubscriptionAccess();
  const tier = accessTier ?? access?.tier ?? 'FREE';
  const [state, setState] = useState(emptyState);
  const [draft, setDraft] = useState('');
  const [usage, setUsage] = useState(null);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyNotice, setHistoryNotice] = useState('');
  const request = useRef(null);
  const scrollRef = useRef(null);
  const composerRef = useRef(null);
  const nearBottom = useRef(true);
  const retryRequest = useRef(null);
  const scopeKey = JSON.stringify({ project: context?.project?.id, version: context?.project?.version });
  const selectionKey = context?.selectionType === 'checkpoint_context' ? '' : JSON.stringify({ type: context?.selectionType, content: context?.selectedContent });
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;

  const generate = async () => {
    if (!context?.selectedContent?.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const requestId = createConversationRequestId('mentor');
    const requestScope = scopeRef.current;
    setState((current) => ({ ...current, phase: 'questions-loading', questions: [], selected: null, followUps: [], error: '' }));
    try {
      const result = await client.generateQuestions(context, { signal: controller.signal, requestId });
      if (result._tutorUsage) setUsage({ ...result._tutorUsage, remainingMessages: result._tutorUsage.unlimited ? null : Math.max(0, result._tutorUsage.includedLimit - result._tutorUsage.usedMessages) });
      if (request.current !== controller || scopeRef.current !== requestScope) return;
      setState((current) => ({ ...current, phase: 'questions', questions: result.questions, selected: null, followUps: [], error: '' }));
    } catch (error) {
      if (error.name !== 'AbortError' && request.current === controller && scopeRef.current === requestScope) setState((current) => ({ ...current, phase: 'error', error: error.message || 'The AI Mentor is unavailable.' }));
    } finally {
      if (request.current === controller) request.current = null;
    }
  };

  const choose = async (question, retrySnapshot = null) => {
    if (!context || !question?.label?.trim() || request.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const requestId = retrySnapshot?.requestId ?? createConversationRequestId('mentor');
    const requestScope = scopeRef.current;
    const history = retrySnapshot?.conversation ?? projectProviderConversation(state.conversation);
    retryRequest.current = Object.freeze({ requestId, question, conversation: history, scopeKey: requestScope });
    setState((value) => ({ ...value, phase: 'answer-loading', selected: question, questions: [], followUps: [], error: '' }));
    try {
      const result = await client.answer(context, question, history, { signal: controller.signal, requestId });
      if (request.current !== controller || scopeRef.current !== requestScope) return;
      if (result._tutorUsage) setUsage({ ...result._tutorUsage, remainingMessages: result._tutorUsage.unlimited ? null : Math.max(0, result._tutorUsage.includedLimit - result._tutorUsage.usedMessages) });
      retryRequest.current = null;
      setState((value) => ({ ...value, phase: 'answer', selected: null, followUps: result.followUps, conversation: reconcileProjectTurns(value.conversation, [{ id: requestId, requestId, question: question.label, answer: result.answer, createdAt: Date.now() }]), error: '' }));
    } catch (error) {
      if (error.name !== 'AbortError' && request.current === controller && scopeRef.current === requestScope) setState((value) => ({ ...value, phase: 'error', error: error.message || 'The AI Mentor is unavailable.' }));
    } finally {
      if (request.current === controller) request.current = null;
    }
  };

  const sendDraft = () => {
    const message = draft.trim();
    if (!message || request.current) return;
    setDraft('');
    void choose({ id: `learner-${Date.now()}`, label: message, intent: 'learner-question' });
  };

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    retryRequest.current = null;
    setState(emptyState());
    nearBottom.current = true;
    return () => { request.current?.abort(); request.current = null; };
    // A new project/checkpoint/language scope intentionally starts a new bounded conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    if (!context?.tutorScope || typeof client.history !== 'function') return undefined;
    const controller = new AbortController(); setHistoryLoading(true); setHistoryNotice('');
    client.history(context.tutorScope, { signal: controller.signal }).then((page) => { setState((value) => ({ ...value, conversation: reconcileProjectTurns(value.conversation, page.items) })); setHistoryCursor(page.nextCursor ?? null); if (page.usage) setUsage(page.usage); }).catch((error) => { if (error.name !== 'AbortError') setHistoryNotice("Previous messages couldn't be loaded. You can still continue using the AI Mentor."); }).finally(() => setHistoryLoading(false));
    return () => controller.abort();
  }, [client, scopeKey]);

  const loadOlder = async (node) => { if (!historyCursor || historyLoading) return; const oldHeight = node.scrollHeight; setHistoryLoading(true); try { const page = await client.history(context.tutorScope, { before: historyCursor }); setState((value) => ({ ...value, conversation: reconcileProjectTurns(value.conversation, page.items) })); setHistoryCursor(page.nextCursor ?? null); requestAnimationFrame(() => { node.scrollTop += node.scrollHeight - oldHeight; }); } finally { setHistoryLoading(false); } };

  useEffect(() => {
    if (!selectionKey) return;
    const selectionPrompt = context.selectionType === 'terminal_output'
      ? 'Help me understand this output.'
      : context.selectionType === 'guide_code' || context.selectionType === 'user_code'
        ? 'Explain this code.'
        : 'Explain this selection.';
    setDraft((current) => current.trim() ? current : selectionPrompt);
    requestAnimationFrame(() => {
      const composer = composerRef.current;
      if (!composer) return;
      composer.focus();
      composer.setSelectionRange(composer.value.length, composer.value.length);
    });
  }, [context?.selectedContent, selectionKey]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && nearBottom.current) {
      if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
      else scroller.scrollTop = scroller.scrollHeight;
    }
  }, [state]);

  if (!canAccessFeature({ tier, feature: ACCESS_FEATURES.AI_TUTOR })) return <PremiumGate context="Project AI Mentor" />;
  const loading = state.phase.endsWith('loading');
  const retry = retryRequest.current?.scopeKey === scopeRef.current
    ? () => choose(retryRequest.current.question, retryRequest.current)
    : generate;

  return <section className="project-contextual-ai" aria-label="Contextual project AI" aria-busy={loading}>
    <header><Bot aria-hidden="true" /><h2>Contextual AI Mentor</h2></header>
    <div className="project-ai-conversation-scroll" ref={scrollRef} role="region" aria-label="AI Mentor conversation" onScroll={(event) => { const node = event.currentTarget; nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 72; if (node.scrollTop === 0) void loadOlder(node); }}>
      {!context ? <div className="project-ai-empty"><p>Ask a question about the current project checkpoint.</p></div> : <>
        {context.selectionType !== 'checkpoint_context' ? <div className="project-ai-context-preview"><span>Selected context</span><strong>{context.selectionType.replaceAll('_', ' ')}</strong><pre>{context.selectedContent}</pre></div> : null}
        {state.phase === 'idle' ? <button className="project-ai-suggest" type="button" onClick={generate}>Suggest questions</button> : null}
        {state.phase === 'questions-loading' ? <MentorStatus>AI Mentor is preparing questions...</MentorStatus> : null}
        {state.questions.length ? <section className="project-ai-suggestions" aria-labelledby="project-ai-explore-title"><h3 id="project-ai-explore-title">What would you like to explore?</h3><div>{state.questions.map((question) => <button type="button" disabled={loading} onClick={() => choose(question)} key={question.id}>{question.label}</button>)}</div></section> : null}
        <div className="project-ai-turns" aria-live="polite">{state.conversation.map((turn) => <ConversationTurn turn={turn} key={turn.id} />)}
          {state.selected ? <div className="project-ai-turn is-user" aria-label="You"><span>You</span><div>{state.selected.label}</div></div> : null}
          {state.phase === 'answer-loading' ? <MentorStatus>AI Mentor is preparing a focused answer...</MentorStatus> : null}
        </div>
        {historyNotice ? <div className="project-ai-history-notice" role="status">{historyNotice}</div> : null}
        {state.followUps.length ? <section className="project-ai-suggestions is-follow-up" aria-labelledby="project-ai-follow-up-title"><h3 id="project-ai-follow-up-title">Continue with:</h3><div>{state.followUps.map((question) => <button type="button" disabled={loading} onClick={() => choose(question)} key={question.id}>{question.label}</button>)}</div></section> : null}
        {state.error ? <div className="project-ai-turn is-mentor is-error" role="alert"><span>AI Mentor</span><div><p>I couldn't generate a response right now.</p><small>{state.error}</small><button type="button" onClick={retry}><RotateCcw /> Retry</button></div></div> : null}
      </>}
    </div>
    <div className="project-ai-composer">
      {usage ? <small className="project-ai-usage">{usage.unlimited ? 'Unlimited AI messages' : `${usage.remainingMessages} AI messages remaining`}</small> : null}
      <textarea ref={composerRef} aria-label="Ask AI Mentor" value={draft} maxLength={9_000} placeholder="Ask about this checkpoint or your code…" disabled={loading || usage?.remainingMessages === 0} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendDraft(); } }} />
      <button type="button" aria-label="Send AI Mentor message" disabled={!draft.trim() || loading || usage?.remainingMessages === 0} onClick={sendDraft}><Send aria-hidden="true" /> Send</button>
    </div>
  </section>;
}

function ConversationTurn({ turn }) {
  return <>{turn.question ? <div className="project-ai-turn is-user" aria-label="You"><span>You</span><div>{turn.question}</div></div> : null}{turn.answer ? <div className="project-ai-turn is-mentor" aria-label="AI Mentor"><span><Sparkles aria-hidden="true" /> AI Mentor</span><div><AITextContent text={turn.answer} /></div></div> : null}</>;
}

function MentorStatus({ children }) {
  return <div className="project-ai-turn is-mentor is-loading" role="status"><span><Bot aria-hidden="true" /> AI Mentor</span><div><LoaderCircle className="is-spinning" /> {children}</div></div>;
}
