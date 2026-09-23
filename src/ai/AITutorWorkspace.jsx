import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, Send, Sparkles } from 'lucide-react';
import { ACCESS_FEATURES, canAccessFeature } from '../access/accessPolicy';
import { useOptionalSubscriptionAccess } from '../access/SubscriptionAccessContext';
import { PremiumGate } from '../access/PremiumGate';
import { aiTutorClient } from './AITutorClient';
import { AITutorResponse } from './AITutorResponse';

const DEFAULT_SELECTION_INTENT = "Explain this selected code in the context of what I'm learning.";

export function AITutorWorkspace({ course, lesson, compilerContext, pendingRequest, client = aiTutorClient, accessTier, activityType = 'lesson', contextLines = [] }) {
  const access = useOptionalSubscriptionAccess();
  const tier = accessTier ?? access?.tier ?? 'FREE';
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const requestRef = useRef(null);
  const handledRequestRef = useRef(null);
  const conversationRef = useRef(null);

  const scrollIfNearBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const node = conversationRef.current;
      if (!node) return;
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      if (distance < 180) node.scrollTop = node.scrollHeight;
    });
  }, []);

  const submit = useCallback(async ({ question, selectionContext = null }) => {
    if (status === 'loading' || !compilerContext?.code?.trim()) return;
    const prompt = question.trim();
    if (!prompt) return;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    const requestType = selectionContext ? 'explain-selection' : 'explain-full-code';
    const userMessage = {
      id: `user-${Date.now()}-${messages.length}`,
      role: 'user',
      text: prompt,
      selectedCode: selectionContext?.text ?? '',
    };
    setMessages((current) => [...current, userMessage]);
    setStatus('loading');
    setError('');
    scrollIfNearBottom();
    try {
      const response = await client.explain({
        requestType,
        language: compilerContext.language,
        code: compilerContext.code,
        selectedCode: selectionContext?.text ?? '',
        selectionSnapshot: selectionContext?.snapshot,
        compilerEvidence: compilerContext.compilerEvidence ?? undefined,
        compilerStatus: compilerContext.compilerStatus ?? 'ready',
        activityType,
        lessonContext: [
          `Course: ${course.id} · ${course.title}`,
          `Lesson: ${lesson.id} · ${lesson.title}`,
          ...contextLines,
          `Learner question: ${prompt}`,
        ].join('\n'),
      }, { signal: controller.signal });
      setMessages((current) => [...current, { id: `assistant-${Date.now()}-${current.length}`, role: 'assistant', response }]);
      setStatus('success');
      scrollIfNearBottom();
    } catch (requestError) {
      if (requestError.name === 'AbortError') return;
      setError(requestError.message || 'The AI Tutor is unavailable.');
      setStatus(requestError.code === 'ai/disabled' ? 'unavailable' : 'error');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [activityType, client, compilerContext, contextLines, course.id, course.title, lesson.id, lesson.title, messages.length, scrollIfNearBottom, status]);

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (!pendingRequest || handledRequestRef.current === pendingRequest.id) return;
    handledRequestRef.current = pendingRequest.id;
    void submit({ question: DEFAULT_SELECTION_INTENT, selectionContext: pendingRequest.selectionContext });
  }, [pendingRequest, submit]);

  if (!canAccessFeature({ tier, feature: ACCESS_FEATURES.AI_TUTOR })) {
    return <div className="ai-workspace-gate"><PremiumGate context="AI Tutor" /></div>;
  }

  const sendDraft = () => {
    const question = draft.trim();
    if (!question) return;
    setDraft('');
    void submit({ question });
  };

  return (
    <section className="ai-workspace" aria-labelledby="learning-ai-title">
      <header className="ai-workspace-header">
        <span className="ai-workspace-icon" aria-hidden="true"><Bot /></span>
        <div><h2 id="learning-ai-title">AI Tutor</h2><p>{course.title} · {lesson.title}</p></div>
      </header>
      <div className="ai-workspace-conversation" ref={conversationRef} aria-live="polite">
        {messages.length === 0 ? <div className="ai-workspace-empty"><Sparkles aria-hidden="true" /><strong>Ask about your code</strong><p>Select code in the editor or ask a question about this lesson.</p></div> : null}
        {messages.map((message) => message.role === 'user' ? (
          <article className="ai-workspace-message is-user" key={message.id}>
            <strong>You</strong><p>{message.text}</p>
            {message.selectedCode ? <pre><code>{message.selectedCode}</code></pre> : null}
          </article>
        ) : (
          <article className="ai-workspace-message is-assistant" key={message.id}>
            <strong>AI Tutor</strong><AITutorResponse response={message.response} />
          </article>
        ))}
        {status === 'loading' ? <div className="ai-workspace-thinking" role="status"><LoaderCircle className="is-spinning" aria-hidden="true" /> AI Tutor is thinking…</div> : null}
        {error ? <div className="ai-workspace-error" role="alert">{error}</div> : null}
      </div>
      <div className="ai-workspace-composer">
        <textarea
          aria-label="Ask AI Tutor"
          placeholder="Ask a question…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendDraft(); }
          }}
          disabled={status === 'loading' || status === 'unavailable'}
        />
        <button type="button" onClick={sendDraft} disabled={!draft.trim() || status === 'loading' || status === 'unavailable'}><Send aria-hidden="true" /> Send</button>
      </div>
    </section>
  );
}
