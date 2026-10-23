import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, RotateCcw, Send, Sparkles } from 'lucide-react';
import { ACCESS_FEATURES, canAccessFeature } from '../../access/accessPolicy';
import { PremiumGate } from '../../access/PremiumGate';
import { useOptionalSubscriptionAccess } from '../../access/SubscriptionAccessContext';
import { projectAIClient } from '../ai/ProjectAIClient';
import { mergeTutorDraft } from '../../ai/tutorComposer';

const emptyState = () => ({ phase: 'idle', questions: [], selected: null, followUps: [], conversation: [], error: '' });

export function ProjectContextualAIConversation({ context, client = projectAIClient, accessTier }) {
  const access = useOptionalSubscriptionAccess();
  const tier = accessTier ?? access?.tier ?? 'FREE';
  const [state, setState] = useState(emptyState);
  const [draft, setDraft] = useState('');
  const request = useRef(null);
  const scrollRef = useRef(null);
  const composerRef = useRef(null);
  const nearBottom = useRef(true);
  const scopeKey = JSON.stringify({ project: context?.project?.id, version: context?.project?.version, checkpoint: context?.checkpoint?.id, languageId: context?.languageId });
  const selectionKey = context?.selectionType === 'checkpoint_context' ? '' : JSON.stringify({ type: context?.selectionType, content: context?.selectedContent });

  const generate = async () => {
    if (!context?.selectedContent?.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ ...emptyState(), phase: 'questions-loading' });
    try {
      const result = await client.generateQuestions(context, { signal: controller.signal });
      setState({ ...emptyState(), phase: 'questions', questions: result.questions });
    } catch (error) {
      if (error.name !== 'AbortError') setState({ ...emptyState(), phase: 'error', error: error.message || 'The AI Mentor is unavailable.' });
    } finally {
      if (request.current === controller) request.current = null;
    }
  };

  const choose = async (question) => {
    if (!context || !question?.label?.trim() || request.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const history = state.conversation;
    setState((value) => ({ ...value, phase: 'answer-loading', selected: question, questions: [], followUps: [], error: '' }));
    try {
      const result = await client.answer(context, question, history, { signal: controller.signal });
      setState((value) => ({ ...value, phase: 'answer', selected: null, followUps: result.followUps, conversation: [...history, { question: question.label, answer: result.answer }].slice(-3), error: '' }));
    } catch (error) {
      if (error.name !== 'AbortError') setState((value) => ({ ...value, phase: 'error', error: error.message || 'The AI Mentor is unavailable.' }));
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
    setState(emptyState());
    nearBottom.current = true;
    return () => { request.current?.abort(); request.current = null; };
    // A new project/checkpoint/language scope intentionally starts a new bounded conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    if (!selectionKey) return;
    setDraft((current) => mergeTutorDraft(current, context.selectedContent));
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
  const retry = state.selected ? () => choose(state.selected) : generate;

  return <section className="project-contextual-ai" aria-label="Contextual project AI" aria-busy={loading}>
    <header><Bot aria-hidden="true" /><h2>Contextual AI Mentor</h2></header>
    <div className="project-ai-conversation-scroll" ref={scrollRef} role="region" aria-label="AI Mentor conversation" onScroll={(event) => { const node = event.currentTarget; nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 72; }}>
      {!context ? <div className="project-ai-empty"><p>Ask a question about the current project checkpoint.</p></div> : <>
        {context.selectionType !== 'checkpoint_context' ? <div className="project-ai-context-preview"><span>Selected context</span><strong>{context.selectionType.replaceAll('_', ' ')}</strong><pre>{context.selectedContent}</pre></div> : null}
        {state.phase === 'idle' ? <button className="project-ai-suggest" type="button" onClick={generate}>Suggest questions</button> : null}
        {state.phase === 'questions-loading' ? <MentorStatus>AI Mentor is preparing questions...</MentorStatus> : null}
        {state.questions.length ? <section className="project-ai-suggestions" aria-labelledby="project-ai-explore-title"><h3 id="project-ai-explore-title">What would you like to explore?</h3><div>{state.questions.map((question) => <button type="button" disabled={loading} onClick={() => choose(question)} key={question.id}>{question.label}</button>)}</div></section> : null}
        <div className="project-ai-turns" aria-live="polite">{state.conversation.map((turn, index) => <ConversationTurn turn={turn} key={`${index}-${turn.question}`} />)}
          {state.selected ? <div className="project-ai-turn is-user" aria-label="You"><span>You</span><div>{state.selected.label}</div></div> : null}
          {state.phase === 'answer-loading' ? <MentorStatus>AI Mentor is preparing a focused answer...</MentorStatus> : null}
        </div>
        {state.followUps.length ? <section className="project-ai-suggestions is-follow-up" aria-labelledby="project-ai-follow-up-title"><h3 id="project-ai-follow-up-title">Continue with:</h3><div>{state.followUps.map((question) => <button type="button" disabled={loading} onClick={() => choose(question)} key={question.id}>{question.label}</button>)}</div></section> : null}
        {state.error ? <div className="project-ai-turn is-mentor is-error" role="alert"><span>AI Mentor</span><div><p>I couldn't generate a response right now.</p><small>{state.error}</small><button type="button" onClick={retry}><RotateCcw /> Retry</button></div></div> : null}
      </>}
    </div>
    <div className="project-ai-composer">
      <textarea ref={composerRef} aria-label="Ask AI Mentor" value={draft} maxLength={9_000} placeholder="Ask about this checkpoint or your code…" disabled={loading} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendDraft(); } }} />
      <button type="button" aria-label="Send AI Mentor message" disabled={!draft.trim() || loading} onClick={sendDraft}><Send aria-hidden="true" /> Send</button>
    </div>
  </section>;
}

function ConversationTurn({ turn }) {
  return <><div className="project-ai-turn is-user" aria-label="You"><span>You</span><div>{turn.question}</div></div><div className="project-ai-turn is-mentor" aria-label="AI Mentor"><span><Sparkles aria-hidden="true" /> AI Mentor</span><div><p>{turn.answer}</p></div></div></>;
}

function MentorStatus({ children }) {
  return <div className="project-ai-turn is-mentor is-loading" role="status"><span><Bot aria-hidden="true" /> AI Mentor</span><div><LoaderCircle className="is-spinning" /> {children}</div></div>;
}
