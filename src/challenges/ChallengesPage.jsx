import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Code2, Coins, Flame, LockKeyhole } from 'lucide-react';
import { CompilerPanel } from '../components/CompilerPanel';
import { createCompilerData } from '../components/blocks/CompilerBlock';
import { DomainErrorBoundary } from '../errors/ErrorBoundary';
import { activityCompletionClient } from '../coins/ActivityCompletionClient';
import { CompilerLanguageSelector } from '../components/CompilerLanguageSelector';
import { useSelectableCompilerLanguage } from '../compiler/useSelectableCompilerLanguage';
import { useContentResource } from '../content/hooks/useContentResource';
import { useLearnerActivity } from '../activity/LearnerActivityContext';
import { kolkataDate } from '../home/challengeCalendar';
import { PracticeProblemContent } from '../practice/PracticeProblemContent';
import { PracticeTestPanel } from '../practice/PracticeTestPanel';
import { ResizeHandle } from '../components/ResizeHandle';
import { useCompilerPaneResize } from '../hooks/useCompilerPaneResize';
import { useApplicationTheme } from '../theme/useApplicationTheme';
import { LAYOUT_SIZE } from '../design-system/theme';
import { Dialog } from '../components/Dialog';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { ChallengeHistory } from './ChallengeHistory';
import { loadDailyChallengeByDate, loadPublishedChallengeCatalog } from './challengeContentSource';
import { CoinRedemptionRepository } from '../repositories/firestore/CoinRedemptionRepository';
import { coinRedemptionClient } from '../coins/CoinRedemptionClient';
import { authService } from '../auth/AuthService';

const isCompleted = (completion, date) => completion.activityType === 'DAILY_CHALLENGE'
  && completion.occurrenceDate === date
  && String(completion.completionStatus).toUpperCase() === 'COMPLETED';

const displayDate = (date) => new Intl.DateTimeFormat('en-IN', {
  month: 'short', day: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T00:00:00Z`));

export function buildChallengeHistory(catalog, completions, today, unlocks = []) {
  return catalog.filter(({ metadata }) => metadata.date < today).sort((left, right) => right.metadata.date.localeCompare(left.metadata.date)).map(({ metadata, content }) => ({
    id: metadata.id, date: metadata.date, displayDate: displayDate(metadata.date), title: content.title,
    difficulty: metadata.difficulty, completed: completions.some((item) => isCompleted(item, metadata.date)), unlocked: unlocks.some((item) => item.occurrenceDate === metadata.date && item.status === 'UNLOCKED'),
  }));
}

export function ChallengesPage({ occurrenceDate, onOpenChallenge, onBack }) {
  return occurrenceDate
    ? <ChallengeWorkspace occurrenceDate={occurrenceDate} onBack={onBack} />
    : <ChallengeHub onOpenChallenge={onOpenChallenge} />;
}

export function ChallengeHub({ onOpenChallenge }) {
  const userId = authService.getCurrentUser()?.uid;
  const activity = useLearnerActivity();
  const today = kolkataDate();
  const loadCatalog = useCallback(() => loadPublishedChallengeCatalog(), []);
  const { data: catalog, error, loading } = useContentResource(loadCatalog);
  const [redemptionState, setRedemptionState] = useState({ balance: 0, redemptions: [] });
  const [passDialog, setPassDialog] = useState(null);
  const loadRedemptions = useCallback(async () => { if (!userId) return; const repository = new CoinRedemptionRepository(userId); const [balance, redemptions] = await Promise.all([repository.getBalance(), repository.listRedemptions()]); setRedemptionState({ balance, redemptions }); }, [userId]);
  useEffect(() => { void loadRedemptions(); }, [loadRedemptions]);
  const todayEntry = catalog?.find(({ metadata }) => metadata.date === today);
  const completed = activity.completions.some((item) => isCompleted(item, today));
  const history = useMemo(() => buildChallengeHistory(catalog ?? [], activity.completions, today, redemptionState.redemptions), [activity.completions, catalog, redemptionState.redemptions, today]);
  const passUses = redemptionState.redemptions.filter((item) => item.type === 'CHALLENGE_PASS' && item.monthKey === today.slice(0, 7)).length;
  const redeemPass = async () => { setPassDialog((current) => ({ ...current, pending: true, error: '' })); try { await coinRedemptionClient.redeem('CHALLENGE_PASS', { requestId: crypto.randomUUID(), occurrenceDate: passDialog.date }); await loadRedemptions(); setPassDialog((current) => ({ ...current, pending: false, success: true })); } catch (nextError) { setPassDialog((current) => ({ ...current, pending: false, error: nextError.message })); } };

  return <div className="challenges-page challenge-hub">
    <section className={`challenge-today-card${completed ? ' is-completed' : ''}`} aria-labelledby="today-challenge-title">
      <div><span>Daily Challenge</span><h1 id="today-challenge-title">{todayEntry?.content.title ?? 'Today’s challenge'}</h1>
        {loading ? <p>Loading today’s challenge…</p> : error ? <p>Today’s challenge could not be loaded.</p> : todayEntry ? <>
          <p>{todayEntry.content.summary}</p>
          <div className="challenge-today-meta"><DifficultyBadge difficulty={todayEntry.content.difficulty} /><span><Clock3 /> ~{todayEntry.content.estimatedMinutes} min</span><span><Coins /> +{todayEntry.metadata.rewardCoins} coins</span></div>
        </> : <p>Today’s challenge is not available yet.</p>}
      </div>
      {todayEntry ? completed ? <div className="challenge-today-action"><strong><CheckCircle2 /> Today’s challenge completed</strong><span>+{todayEntry.metadata.rewardCoins} coins earned</span><button className="button button--secondary" type="button" onClick={() => onOpenChallenge(today)}>Review Challenge</button></div>
        : <button className="button button--primary" type="button" onClick={() => onOpenChallenge(today)}>Start Today’s Challenge</button> : null}
    </section>
    <ChallengeHistory history={history} onOpenChallenge={onOpenChallenge} onUsePass={setPassDialog} balance={redemptionState.balance} passUses={passUses} redemptionReady={Boolean(userId)} />
    <Dialog open={Boolean(passDialog)} title={passDialog?.success ? 'Challenge unlocked' : `Unlock ${passDialog?.displayDate ?? ''} Daily Challenge?`} description={passDialog?.success ? 'Recovered challenges do not restore past streaks.' : `Costs 150 coins. You have ${Math.max(0, 3 - passUses)} of 3 recoveries remaining this month.`} onClose={() => setPassDialog(null)}>
      {passDialog?.error ? <p role="alert">{passDialog.error}</p> : null}<div className="dialog-actions"><button className="button button--secondary" type="button" disabled={passDialog?.pending} onClick={() => setPassDialog(null)}>{passDialog?.success ? 'Close' : 'Cancel'}</button>{passDialog?.success ? <button className="button button--primary" type="button" onClick={() => { const date = passDialog.date; setPassDialog(null); onOpenChallenge(date); }}>Open Challenge</button> : <button className="button button--primary" type="button" disabled={passDialog?.pending} onClick={redeemPass}>{passDialog?.pending ? 'Unlocking…' : 'Unlock Challenge'}</button>}</div>
    </Dialog>
  </div>;
}

export function ChallengeWorkspace({ occurrenceDate, onBack }) {
  const userId = authService.getCurrentUser()?.uid;
  const activity = useLearnerActivity();
  const loadChallenge = useCallback(() => loadDailyChallengeByDate(occurrenceDate), [occurrenceDate]);
  const { data: challenge, error, loading } = useContentResource(loadChallenge);
  const initiallyCompleted = activity.completions.some((item) => isCompleted(item, occurrenceDate));
  const [verificationStatus, setVerificationStatus] = useState('idle');
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [completion, setCompletion] = useState({ pending: false, rewardStatus: null, rewardAmount: 0, error: null });
  const [celebration, setCelebration] = useState(null);
  const [compilerStatus, setCompilerStatus] = useState('ready');
  const [recoveryUnlocked, setRecoveryUnlocked] = useState(false);
  const { theme } = useApplicationTheme();
  const compilerResize = useCompilerPaneResize();
  const compilerDefinitions = useMemo(() => challenge?.blocks.filter((block) => block.type === 'compiler').map(createCompilerData) ?? [], [challenge]);
  const compilerLanguage = useSelectableCompilerLanguage(compilerDefinitions, challenge?.language);
  const compiler = compilerLanguage.activeDefinition;
  const today = kolkataDate();
  const reviewMode = completed || (occurrenceDate !== today && !recoveryUnlocked);
  const canComplete = (occurrenceDate === today || recoveryUnlocked) && !completed && verificationStatus === 'matched';

  useEffect(() => {
    if (occurrenceDate >= today || !userId) return undefined;
    let active = true;
    new CoinRedemptionRepository(userId).getUnlock(occurrenceDate).then((unlock) => { if (active) setRecoveryUnlocked(unlock?.status === 'UNLOCKED'); }, () => undefined);
    return () => { active = false; };
  }, [occurrenceDate, today, userId]);

  useEffect(() => { if (initiallyCompleted) setCompleted(true); }, [initiallyCompleted]);

  const complete = async () => {
    if (!canComplete) return;
    setCompletion((current) => ({ ...current, pending: true, error: null }));
    try {
      const result = await activityCompletionClient.complete({ activityType: 'DAILY_CHALLENGE', activityId: challenge.activityId ?? challenge.id, activityVersion: challenge.version });
      setCompleted(['completed', 'already_completed'].includes(result.completionStatus));
      setCompletion({ pending: false, rewardStatus: result.rewardStatus, rewardAmount: result.rewardAmount ?? 0, error: null });
      if (result.completionStatus === 'completed') {
        setCelebration({ challengeTitle: challenge.title, rewardAmount: result.rewardAmount ?? 0, streak: Math.max(0, Number(result.streak?.currentStreak) || 0) });
      }
      await activity.refresh?.();
    } catch (nextError) { setCompletion((current) => ({ ...current, pending: false, error: nextError.message })); }
  };

  if (loading || error || !challenge || !compiler) return <div className="challenges-page"><button className="practice-back-button" type="button" onClick={onBack}><ArrowLeft /> Back to Challenges</button><h1>Daily Challenge</h1><p role="status">{loading ? 'Loading challenge…' : 'This daily challenge is unavailable.'}</p></div>;

  return <div className="practice-immersive-shell" data-theme={theme}>
    <div className="practice-immersive-workspace has-compiler" data-immersive-coding-workspace="challenge" ref={compilerResize.workspaceRef} style={{ '--compiler-width': `${compilerResize.value}px`, '--lesson-pane-min': `${LAYOUT_SIZE.lesson.min}px` }}>
      <article className="practice-problem lesson-panel">
        <header className="practice-detail-header"><button className="practice-back-button" type="button" onClick={onBack}><ArrowLeft /> Back to Challenges</button><h1>{challenge.title}</h1>{reviewMode ? <span className="challenge-review-label">Review mode</span> : null}</header>
        <PracticeProblemContent question={challenge} />
        <footer className={`practice-completion ${canComplete ? 'is-ready' : ''}`}><span>{completion.error ? completion.error : completed ? <><CheckCircle2 /> Challenge completed</> : reviewMode ? <><LockKeyhole /> Historical challenges require a Challenge Pass.</> : canComplete ? <><CheckCircle2 /> Output verified. Save completion to earn the daily reward.</> : <><LockKeyhole /> Run and check your solution to continue.</>}</span><button className="button button--primary" type="button" disabled={!canComplete || completion.pending} onClick={complete}><Coins /> {completion.pending ? 'Saving…' : completed ? 'Completed' : reviewMode ? 'Review only' : 'Save Completion'}</button></footer>
      </article>
      <aside className={`desktop-compiler compiler-dock practice-compiler-dock is-expanded compiler-enter is-${compilerStatus}`} aria-label="Challenge compiler"><div className="compiler-dock-header"><span className="compiler-dock-identity"><span className="compiler-dock-symbol"><Code2 aria-hidden="true" /></span><strong>Compiler Dock</strong></span></div><div className="compiler-dock-body"><DomainErrorBoundary name="challenge-compiler" title="The code workspace could not be displayed." description="The challenge remains available. Retry the workspace to continue." resetKeys={[challenge.id]} compact><CompilerPanel ref={compilerLanguage.panelRef} compiler={compiler} instanceId={`challenge-${challenge.id}-${occurrenceDate}`} lessonContext={challenge.title} activityType="challenge" onVerificationChange={setVerificationStatus} onExecutionStateChange={setCompilerStatus} languageSelector={<CompilerLanguageSelector value={compilerLanguage.language} options={compilerLanguage.options} disabled={compilerLanguage.switching} onChange={compilerLanguage.selectLanguage} />} renderOutput={(props) => <PracticeTestPanel {...props} tests={[]} />} /></DomainErrorBoundary></div></aside>
      <ResizeHandle className="compiler-resize-handle" label="Resize problem and compiler panes" min={LAYOUT_SIZE.compiler.min} max={compilerResize.max} value={compilerResize.value} onPointerDown={compilerResize.startDragging} onKeyDown={compilerResize.handleKeyDown} />
    </div>
    <Dialog open={Boolean(celebration)} title="Daily Challenge Completed!" description="Come back tomorrow for the next challenge." onClose={() => setCelebration(null)} className="challenge-completion-dialog">
      <div className="challenge-completion-dialog-mark" aria-hidden="true"><CheckCircle2 /></div>
      <strong className="challenge-completion-dialog-title">{celebration?.challengeTitle}</strong>
      <div className="challenge-completion-dialog-results">
        <span><Flame aria-hidden="true" fill="currentColor" /><strong>{celebration?.streak ?? 0}</strong> day streak</span>
        <span><Coins aria-hidden="true" /><strong>+{celebration?.rewardAmount ?? 0}</strong> coins earned</span>
      </div>
      <div className="challenge-completion-dialog-actions">
        <button className="button button--secondary" type="button" onClick={() => { setCelebration(null); onBack(); }}>Back to Challenges</button>
        <button className="button button--primary" type="button" onClick={() => setCelebration(null)} data-autofocus>Close</button>
      </div>
    </Dialog>
  </div>;
}
