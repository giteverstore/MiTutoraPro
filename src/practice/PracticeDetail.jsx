import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Code2, LockKeyhole, Maximize2, Minus } from 'lucide-react';
import { CompilerPanel } from '../components/CompilerPanel';
import { ResizeHandle } from '../components/ResizeHandle';
import { createCompilerData } from '../components/blocks/CompilerBlock';
import { DomainErrorBoundary } from '../errors/ErrorBoundary';
import { PracticeTestPanel } from './PracticeTestPanel';
import { PracticeProblemContent } from './PracticeProblemContent';
import { useCompilerPaneResize } from '../hooks/useCompilerPaneResize';
import { useApplicationTheme } from '../theme/useApplicationTheme';
import { ICON_SIZE, LAYOUT_SIZE } from '../design-system/theme';
import { CompilerLanguageSelector } from '../components/CompilerLanguageSelector';
import { useSelectableCompilerLanguage } from '../compiler/useSelectableCompilerLanguage';

export function PracticeDetail({ question, solved, onBack, onComplete, requireAuthentication = false, onRequireAuth = () => {} }) {
  const [verificationStatus, setVerificationStatus] = useState(solved ? 'matched' : 'idle');
  const [completion, setCompletion] = useState({ pending: false, rewardStatus: null, rewardAmount: 0, error: null });
  const [compilerStatus, setCompilerStatus] = useState('ready');
  const [isCompilerMinimized, setIsCompilerMinimized] = useState(false);
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

  return <div className="practice-immersive-shell" data-theme={theme} data-brand-theme={brandTheme}>
    <div className={`practice-immersive-workspace ${isCompilerMinimized ? 'is-compiler-minimized' : 'has-compiler'}`} data-immersive-coding-workspace="practice" ref={compilerResize.workspaceRef} style={{ '--compiler-width': `${compilerResize.value}px`, '--lesson-pane-min': `${LAYOUT_SIZE.lesson.min}px` }}>
      <article className="practice-problem lesson-panel">
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
      <aside className={`desktop-compiler compiler-dock practice-compiler-dock ${isCompilerMinimized ? 'is-minimized' : 'is-expanded compiler-enter'} is-${compilerStatus}`} aria-label="Practice compiler">
        {isCompilerMinimized ? <button className="compiler-dock-launcher" type="button" onClick={() => setIsCompilerMinimized(false)} aria-expanded="false" aria-label="Open compiler"><span className="compiler-dock-symbol"><Code2 size={ICON_SIZE.md} aria-hidden="true" /></span><span className="compiler-dock-word" aria-hidden="true">Compiler</span><Maximize2 size={ICON_SIZE.sm} aria-hidden="true" /></button> : <div className="compiler-dock-header"><span className="compiler-dock-identity"><span className="compiler-dock-symbol"><Code2 size={ICON_SIZE.md} aria-hidden="true" /></span><strong>Compiler Dock</strong></span><button className="compiler-dock-minimize" type="button" onClick={() => setIsCompilerMinimized(true)} aria-label="Minimize compiler" title="Minimize compiler"><Minus size={ICON_SIZE.md} aria-hidden="true" /></button></div>}
        <div className="compiler-dock-body" aria-hidden={isCompilerMinimized}>
          {requireAuthentication ? <div className="practice-auth-required"><LockKeyhole /><h2>Sign in to solve this question</h2><p>Browse the problem now, then sign in to run code and save tracked progress.</p><button className="button button--primary" type="button" onClick={onRequireAuth}>Login to continue</button></div> :
          <DomainErrorBoundary name="practice-compiler" title="The code workspace could not be displayed." description="The problem statement is still available. Retry the workspace when you are ready." resetKeys={[question.id]} compact>
            <CompilerPanel ref={compilerLanguage.panelRef} compiler={compiler} instanceId={`practice-${question.id}`} lessonContext={question.title} activityType="practice" onVerificationChange={setVerificationStatus} onExecutionStateChange={setCompilerStatus} languageSelector={<CompilerLanguageSelector value={compilerLanguage.language} options={compilerLanguage.options} disabled={compilerLanguage.switching} onChange={compilerLanguage.selectLanguage} />} renderOutput={(outputProps) => <PracticeTestPanel {...outputProps} contract={question.contract} tests={question.publicTests ?? []} />} key={question.id} />
          </DomainErrorBoundary>}
        </div>
      </aside>
      {!isCompilerMinimized ? <ResizeHandle className="compiler-resize-handle" label="Resize problem and compiler panes" min={LAYOUT_SIZE.compiler.min} max={compilerResize.max} value={compilerResize.value} onPointerDown={compilerResize.startDragging} onKeyDown={compilerResize.handleKeyDown} /> : null}
    </div>
  </div>;
}
