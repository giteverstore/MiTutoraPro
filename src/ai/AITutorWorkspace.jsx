import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, Send, Sparkles } from 'lucide-react';
import { ACCESS_FEATURES, canAccessFeature } from '../access/accessPolicy';
import { useOptionalSubscriptionAccess } from '../access/SubscriptionAccessContext';
import { PremiumGate } from '../access/PremiumGate';
import { aiTutorClient } from './AITutorClient';
import { AITutorResponse } from './AITutorResponse';
import { ErrorState } from '../errors/ErrorState';
import { mergeTutorDraft } from './tutorComposer';

function conversationAnswer(response) {
  return [
    response?.summary,
    ...(response?.sections ?? []).map((item) => item.body),
    ...(response?.concepts ?? []).map((item) => `${item.name}: ${item.explanation}`),
    ...(response?.issues ?? []).map((item) => `${item.title}: ${item.explanation}`),
    response?.nextStep?.kind === 'none' ? '' : response?.nextStep?.text,
  ].filter(Boolean).join('\n').slice(0, 4_000);
}

export function AITutorWorkspace({ course, lesson, compilerContext, pendingRequest, client = aiTutorClient, accessTier, activityType = 'lesson', contextLines = [], emptyTitle = 'Ask about your code', emptyText = 'Select code in the editor or ask a question about this lesson.', composerPlaceholder = 'Ask a question…', assistantLabel = 'AI Tutor' }) {
  const access = useOptionalSubscriptionAccess();
  const tier = accessTier ?? access?.tier ?? 'FREE';
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [usage, setUsage] = useState(null);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const requestRef = useRef(null);
  const handledRequestRef = useRef(null);
  const conversationRef = useRef(null);
  const composerRef = useRef(null);

  const scrollIfNearBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const node = conversationRef.current;
      if (!node) return;
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      if (distance < 180) node.scrollTop = node.scrollHeight;
    });
  }, []);

  const submit = useCallback(async ({ question }) => {
    if (status === 'loading' || usage?.remainingMessages === 0 || !compilerContext?.code?.trim()) return;
    const prompt = question.trim();
    if (!prompt) return;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    const userMessage = {
      id: `user-${Date.now()}-${messages.length}`,
      role: 'user',
      text: prompt,
    };
    setMessages((current) => [...current, userMessage]);
    setStatus('loading');
    setError('');
    scrollIfNearBottom();
    try {
      const conversation = [];
      for (let index = 0; index < messages.length - 1; index += 1) {
        const user = messages[index];
        const assistant = messages[index + 1];
        if (user.role === 'user' && assistant.role === 'assistant') conversation.push({ question: user.text, answer: conversationAnswer(assistant.response) });
      }
      const response = await client.explain({
        requestId: globalThis.crypto?.randomUUID?.() ?? `tutor-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        requestType: 'explain-full-code',
        language: compilerContext.language,
        code: compilerContext.code,
        selectedCode: '',
        compilerEvidence: compilerContext.compilerEvidence ?? undefined,
        compilerStatus: compilerContext.compilerStatus ?? 'ready',
        activityType,
        tutorScope: {
          surface: activityType === 'practice' ? 'practice' : 'course',
          scopeId: activityType === 'practice' ? lesson.id : course.id,
          activityId: lesson.id,
          ...(Number.isSafeInteger(activityType === 'practice' ? lesson.version : course.contentVersion) ? { contentVersion: activityType === 'practice' ? lesson.version : course.contentVersion } : {}),
        },
        learnerMessage: prompt,
        conversation: conversation.slice(-3),
        lessonContext: [
          `Course: ${course.title}`,
          `Lesson: ${lesson.title}`,
          ...contextLines,
        ].join('\n'),
      }, { signal: controller.signal });
      setMessages((current) => [...current, { id: `assistant-${Date.now()}-${current.length}`, role: 'assistant', response }]);
      if (response._tutorUsage) setUsage({ ...response._tutorUsage, remainingMessages: response._tutorUsage.unlimited ? null : Math.max(0, response._tutorUsage.includedLimit - response._tutorUsage.usedMessages) });
      setStatus('success');
      scrollIfNearBottom();
    } catch (requestError) {
      if (requestError.name === 'AbortError') return;
      setError(requestError.message || 'The AI Tutor is unavailable.');
      setStatus(requestError.code === 'ai/disabled' ? 'unavailable' : 'error');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [activityType, client, compilerContext, contextLines, course.id, course.title, lesson.id, lesson.title, messages, scrollIfNearBottom, status, usage]);

  const scope = { surface: activityType === 'practice' ? 'practice' : 'course', scopeId: activityType === 'practice' ? lesson.id : course.id, activityId: lesson.id, ...(Number.isSafeInteger(activityType === 'practice' ? lesson.version : course.contentVersion) ? { contentVersion: activityType === 'practice' ? lesson.version : course.contentVersion } : {}) };
  useEffect(() => {
    if (activityType === 'practice' || typeof client.history !== 'function') return undefined;
    const controller = new AbortController(); setHistoryLoading(true);
    client.history(scope, { signal: controller.signal }).then((page) => { setMessages(page.items ?? []); setHistoryCursor(page.nextCursor ?? null); if (page.usage) setUsage(page.usage); }).catch((cause) => { if (cause.name !== 'AbortError') setError(cause.message); }).finally(() => setHistoryLoading(false));
    return () => controller.abort();
  }, [activityType, client, course.id, course.contentVersion]);
  const loadOlder = async () => { if (!historyCursor || historyLoading || typeof client.history !== 'function') return; const node = conversationRef.current; const oldHeight = node?.scrollHeight ?? 0; setHistoryLoading(true); try { const page = await client.history(scope, { before: historyCursor }); setMessages((current) => [...(page.items ?? []).filter((item) => !current.some((existing) => existing.id === item.id)), ...current]); setHistoryCursor(page.nextCursor ?? null); requestAnimationFrame(() => { if (node) node.scrollTop += node.scrollHeight - oldHeight; }); } finally { setHistoryLoading(false); } };

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (!pendingRequest || handledRequestRef.current === pendingRequest.id) return;
    handledRequestRef.current = pendingRequest.id;
    setDraft((current) => mergeTutorDraft(current, pendingRequest.selectionContext?.text));
    requestAnimationFrame(() => {
      const composer = composerRef.current;
      if (!composer) return;
      composer.focus();
      composer.setSelectionRange(composer.value.length, composer.value.length);
    });
  }, [pendingRequest]);

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
      <div className="ai-workspace-conversation" ref={conversationRef} aria-live="polite" onScroll={(event) => { if (event.currentTarget.scrollTop === 0) void loadOlder(); }}>
        {messages.length === 0 ? <div className="ai-workspace-empty"><Sparkles aria-hidden="true" /><strong>{emptyTitle}</strong><p>{emptyText}</p></div> : null}
        {messages.map((message) => message.role === 'user' ? (
          <article className="ai-workspace-message is-user" key={message.id}>
            <strong>You</strong><p>{message.text}</p>
            {message.selectedCode ? <pre><code>{message.selectedCode}</code></pre> : null}
          </article>
        ) : (
          <article className="ai-workspace-message is-assistant" key={message.id}>
            <strong>{assistantLabel}</strong><AITutorResponse response={message.response} />
          </article>
        ))}
        {status === 'loading' ? <div className="ai-workspace-thinking" role="status"><LoaderCircle className="is-spinning" aria-hidden="true" /> AI Tutor is thinking…</div> : null}
        {error ? <ErrorState title={status === 'unavailable' ? 'AI Tutor unavailable' : 'AI Tutor could not respond'} description={error} variant="compact" kind={status === 'unavailable' ? 'unavailable' : 'failure'} alert /> : null}
      </div>
      <div className="ai-workspace-composer">
        {usage ? <small className="ai-workspace-usage">{usage.unlimited ? 'Unlimited AI messages' : `${usage.remainingMessages} AI messages remaining`}</small> : null}
        <textarea
          ref={composerRef}
          aria-label="Ask AI Tutor"
          placeholder={composerPlaceholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendDraft(); }
          }}
          disabled={status === 'loading' || status === 'unavailable' || usage?.remainingMessages === 0}
        />
        <button type="button" onClick={sendDraft} disabled={!draft.trim() || status === 'loading' || status === 'unavailable' || usage?.remainingMessages === 0}><Send aria-hidden="true" /> Send</button>
      </div>
    </section>
  );
}
