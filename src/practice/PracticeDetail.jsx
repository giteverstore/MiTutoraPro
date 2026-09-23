import { useCallback, useMemo, useState } from 'react';
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

export function PracticeDetail({ question, solved, onBack, onComplete, requireAuthentication = false, onRequireAuth = () => {} }) {
  const [verificationStatus, setVerificationStatus] = useState(solved ? 'matched' : 'idle');
  const [completion, setCompletion] = useState({ pending: false, rewardStatus: null, rewardAmount: 0, error: null });
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
  const compilerLanguage = useSelectableCompilerLanguage(compilerDefinitions, question.language);
  const compiler = compilerLanguage.activeDefinition;
  const canComplete = verificationStatus === 'matched';
  const rewardMessage = {
    credited: `+${completion.rewardAmount} coins earned`, already_claimed: 'reward already claimed',
    daily_reward_cap_reached: 'daily reward cap reached', unavailable: 'reward reconciliation pending',
    daily_limit_reached: 'reward unavailable', activity_not_rewardable: 'reward unavailable', policy_disabled: 'reward unavailable',
  }[completion.rewardStatus] ?? 'completion recorded';
  const complete = async () => {
    setCompletion((current) => ({ ...current, pending: true, error: null }));
    try {
      const result = await onComplete(question);
      setCompletion({ pending: false, rewardStatus: result.rewardStatus, rewardAmount: result.rewardAmount ?? 0, error: null });
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
          <span>{canComplete ? <CheckCircle2 /> : <LockKeyhole />}{completion.error ? completion.error : solved ? `Completed · ${rewardMessage}` : canComplete ? 'Output verified. You can mark this solution complete.' : 'Run your solution and check its output to continue.'}</span>
          <button className="button button--primary" type="button" disabled={!canComplete || solved || completion.pending} onClick={complete}><CheckCircle2 /> {completion.pending ? 'Saving…' : solved ? 'Completed' : 'Save Completion'}</button>
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
        panelProps={{ instanceId: `practice-${question.id}`, activityType: 'practice', onVerificationChange: setVerificationStatus, onExecutionStateChange: setCompilerStatus, languageSelector: <CompilerLanguageSelector value={compilerLanguage.language} options={compilerLanguage.options} disabled={compilerLanguage.switching} onChange={compilerLanguage.selectLanguage} />, isCompilerMinimized, onToggleCompiler: toggleCompiler, onAskAITutor: handleAskAITutor, onContextChange: setCompilerContext, aiEnabled: true, publicTests: question.publicTests ?? [], contract: question.contract }}
        errorBoundary={{ name: 'practice-compiler', title: 'The code workspace could not be displayed.', description: 'The problem statement is still available. Retry the workspace when you are ready.', resetKeys: [question.id] }}
        resize={{ label: 'Resize problem and compiler panes', min: LAYOUT_SIZE.compiler.min, max: compilerResize.max, value: compilerResize.value, onPointerDown: compilerResize.startDragging, onKeyDown: compilerResize.handleKeyDown }}
      />
    </div>
  </div>;
}
