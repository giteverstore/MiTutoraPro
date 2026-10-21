import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, LockKeyhole } from 'lucide-react';
import { createCompilerData } from '../components/blocks/CompilerBlock';
import { PracticeProblemContent } from './PracticeProblemContent';
import { useCompilerPaneResize } from '../hooks/useCompilerPaneResize';
import { useApplicationTheme } from '../theme/useApplicationTheme';
import { LAYOUT_SIZE } from '../design-system/theme';
import { CompilerLanguageSelector } from '../components/CompilerLanguageSelector';
import { useSelectableCompilerLanguage } from '../compiler/useSelectableCompilerLanguage';
import { LearningWorkspaceToolbar } from '../components/LearningWorkspaceToolbar';
import { AITutorWorkspace } from '../ai/AITutorWorkspace';
import { SharedCompilerDock } from '../components/SharedCompilerDock';
import { CompletionCelebration } from '../components/CompletionCelebration';
import { ACTIVITY_LANGUAGE_OPTIONS } from '../compiler/languages/activityLanguageOptions';

export function PracticeDetail({ question, solved, onBack, onComplete, requireAuthentication = false, onRequireAuth = () => {} }) {
  const [completion, setCompletion] = useState({ pending: false, rewardStatus: null, rewardAmount: 0, error: null });
  const [completed, setCompleted] = useState(solved);
  const [celebration, setCelebration] = useState(null);
  const [compilerStatus, setCompilerStatus] = useState('ready');
  const [isCompilerMinimized, setIsCompilerMinimized] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState('question');
  const [compilerContext, setCompilerContext] = useState(null);
  const [pendingTutorRequest, setPendingTutorRequest] = useState(null);
  const { theme, brandTheme } = useApplicationTheme();
  const compilerResize = useCompilerPaneResize();
  const compilerDefinitions = useMemo(
    () => question.blocks.filter((block) => block.type === 'compiler').map(createCompilerData),
    [question],
  );
  const compilerLanguage = useSelectableCompilerLanguage(compilerDefinitions, question.language, { languages: ACTIVITY_LANGUAGE_OPTIONS, includeUnavailable: true });
  const compiler = compilerLanguage.activeDefinition;
  useEffect(() => { if (solved) setCompleted(true); }, [solved]);
  const canComplete = !completed && !requireAuthentication;
  const rewardMessage = {
    credited: `+${completion.rewardAmount} coins earned`, already_claimed: 'reward already claimed',
    daily_reward_cap_reached: 'daily reward cap reached', unavailable: 'reward reconciliation pending',
    daily_limit_reached: 'reward unavailable', activity_not_rewardable: 'reward unavailable', policy_disabled: 'reward unavailable',
  }[completion.rewardStatus] ?? 'completion recorded';
  const complete = async () => {
    if (!canComplete || completion.pending) return;
    setCompletion((current) => ({ ...current, pending: true, error: null }));
    try {
      const result = await onComplete(question);
      setCompletion({ pending: false, rewardStatus: result.rewardStatus, rewardAmount: result.rewardAmount ?? 0, error: null });
      if (['completed', 'already_completed'].includes(result.completionStatus)) setCompleted(true);
      if (result.completionStatus === 'completed') setCelebration({ variant: 'practice', message: 'Practice question completed!' });
    } catch (error) {
      setCompletion({ pending: false, rewardStatus: null, rewardAmount: 0, error: error.message });
    }
  };
  const toggleCompiler = useCallback(() => setIsCompilerMinimized((current) => !current), []);
  const handleAskAITutor = useCallback((context) => {
    setCompilerContext((current) => ({ ...current, ...context }));
    setPendingTutorRequest({ id: `${Date.now()}-${context.selectionContext.snapshot.selectionHash}`, selectionContext: context.selectionContext });
    setActiveWorkspace('ai');
  }, []);

  return <div className="practice-immersive-shell" data-theme={theme} data-brand-theme={brandTheme}>
    <div className={`practice-immersive-workspace coding-workspace ${isCompilerMinimized ? 'is-compiler-minimized' : 'has-compiler'}`} data-immersive-coding-workspace="practice" ref={compilerResize.workspaceRef} style={{ '--compiler-width': `${compilerResize.value}px`, '--lesson-pane-min': `${LAYOUT_SIZE.lesson.min}px` }}>
      <section className="practice-main-region coding-workspace__content">
        <LearningWorkspaceToolbar activeView={activeWorkspace} onViewChange={setActiveWorkspace} compilerMinimized={isCompilerMinimized} onRestoreCompiler={toggleCompiler} primaryView="question" primaryLabel="Question" panelPrefix="practice" />
      <article className="practice-problem lesson-panel" id="practice-question-panel" role="tabpanel" hidden={activeWorkspace !== 'question'}>
        <header className="practice-detail-header">
          <button className="practice-back-button" type="button" onClick={onBack}><ArrowLeft /> Back to Practice</button>
          <h1>{question.title}</h1>
        </header>
        <PracticeProblemContent question={question} />
        <footer className={`practice-completion ${canComplete ? 'is-ready' : ''}`}>
          <span>{canComplete || completed ? <CheckCircle2 /> : <LockKeyhole />}{completion.error ? completion.error : completed ? `Completed · ${rewardMessage}` : requireAuthentication ? 'Sign in to save your completion.' : 'Ready to complete.'}</span>
          <button className="button button--primary" type="button" disabled={completed || completion.pending} onClick={requireAuthentication ? onRequireAuth : complete}><CheckCircle2 /> {completion.pending ? 'Saving…' : completed ? 'Completed' : requireAuthentication ? 'Sign in to complete' : 'Save Completion'}</button>
        </footer>
      </article>
      <div className="practice-ai-region" id="practice-ai-panel" role="tabpanel" hidden={activeWorkspace !== 'ai'}>
        <AITutorWorkspace course={{ id: 'practice', title: 'Practice' }} lesson={question} compilerContext={compilerContext ?? { code: compiler.editor.lines.map((line) => line.text ?? '').join('\n'), language: compiler.language, fileName: compiler.editor.fileName, compilerStatus: 'ready' }} pendingRequest={pendingTutorRequest} activityType="practice" contextLines={[`Question: ${question.id} - ${question.title}`, `Description: ${question.summary ?? ''}`, `Topic: ${question.topic ?? 'unavailable'}`, `Difficulty: ${question.difficulty ?? 'unavailable'}`, `Expected output: ${compiler.expectedOutput ?? 'not provided'}`]} />
      </div>
      </section>
      <SharedCompilerDock
        ariaLabel="Practice compiler"
        className="practice-compiler-dock"
        compilerStatus={compilerStatus}
        minimized={isCompilerMinimized}
        panelRef={compilerLanguage.panelRef}
        compiler={compiler}
        unavailableContent={requireAuthentication ? <div className="practice-auth-required"><LockKeyhole /><h2>Sign in to solve this question</h2><p>Browse the problem now, then sign in to run code and save tracked progress.</p><button className="button button--primary" type="button" onClick={onRequireAuth}>Login to continue</button></div> : null}
        panelProps={{ instanceId: `practice-${question.id}`, activityType: 'practice', onExecutionStateChange: setCompilerStatus, languageSelector: <CompilerLanguageSelector value={compilerLanguage.language} options={compilerLanguage.options} disabled={compilerLanguage.switching} onChange={compilerLanguage.selectLanguage} />, isCompilerMinimized, onToggleCompiler: toggleCompiler, onAskAITutor: handleAskAITutor, onContextChange: setCompilerContext, aiEnabled: true, publicTests: compilerLanguage.configured ? question.publicTests ?? [] : [], contract: compilerLanguage.configured ? question.contract : null }}
        errorBoundary={{ name: 'practice-compiler', title: 'The code workspace could not be displayed.', description: 'The problem statement is still available. Retry the workspace when you are ready.', resetKeys: [question.id] }}
        resize={{ label: 'Resize problem and compiler panes', min: LAYOUT_SIZE.compiler.min, max: compilerResize.max, value: compilerResize.value, onPointerDown: compilerResize.startDragging, onKeyDown: compilerResize.handleKeyDown }}
      />
    </div>
    <CompletionCelebration event={celebration} />
  </div>;
}
