import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import { ACCESS_FEATURES, canAccessFeature } from '../../access/accessPolicy';
import { PremiumGate } from '../../access/PremiumGate';
import { useOptionalSubscriptionAccess } from '../../access/SubscriptionAccessContext';
import { projectAIClient } from '../ai/ProjectAIClient';

const emptyState = () => ({ phase: 'idle', questions: [], selected: null, followUps: [], conversation: [], error: '' });

export function ProjectContextualAIConversation({ context, client = projectAIClient, accessTier }) {
  const access = useOptionalSubscriptionAccess();
  const tier = accessTier ?? access?.tier ?? 'FREE';
  const [state, setState] = useState(emptyState);
  const request = useRef(null);
  const scrollRef = useRef(null);
  const nearBottom = useRef(true);
  const contextKey = JSON.stringify(context ?? null);

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
    }
  };

  const choose = async (question) => {
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
    }
  };

  useEffect(() => {
    request.current?.abort();
    setState(emptyState());
    nearBottom.current = true;
    if (context?.selectedContent?.trim()) void generate();
    return () => request.current?.abort();
    // A new bounded context intentionally starts a new ephemeral conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

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
      {!context ? <div className="project-ai-empty"><p>Select guide text, guide code, your code, or terminal output to ask a focused question.</p><span className="project-ai-selection-state">No context selected</span></div> : <>
        <div className="project-ai-context-preview"><span>Selected context</span><strong>{context.selectionType.replaceAll('_', ' ')}</strong><pre>{context.selectedContent}</pre></div>
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
    <small>No free-form composer. Context is limited to this selection and checkpoint.</small>
  </section>;
}

function ConversationTurn({ turn }) {
  return <><div className="project-ai-turn is-user" aria-label="You"><span>You</span><div>{turn.question}</div></div><div className="project-ai-turn is-mentor" aria-label="AI Mentor"><span><Sparkles aria-hidden="true" /> AI Mentor</span><div><p>{turn.answer}</p></div></div></>;
}

function MentorStatus({ children }) {
  return <div className="project-ai-turn is-mentor is-loading" role="status"><span><Bot aria-hidden="true" /> AI Mentor</span><div><LoaderCircle className="is-spinning" /> {children}</div></div>;
}
