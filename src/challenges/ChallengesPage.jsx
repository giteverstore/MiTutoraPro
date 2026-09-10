import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Coins, LockKeyhole } from 'lucide-react';
import { BlockRenderer } from '../components/BlockRenderer';
import { CompilerPanel } from '../components/CompilerPanel';
import { createCompilerData } from '../components/blocks/CompilerBlock';
import { BookmarkToggle } from '../bookmarks/BookmarkToggle';
import { createChallengeBookmark } from '../bookmarks/bookmarkModel';
import { ChallengeHero } from './ChallengeHero';
import { ChallengeHistory } from './ChallengeHistory';
import { CurrentStreak, RewardSummary } from './ChallengeSummary';
import { useContentResource } from '../content/hooks/useContentResource';
import { loadDailyChallenge } from './challengeContentSource';
import { challengeHistory } from './challengeData';
import { DomainErrorBoundary } from '../errors/ErrorBoundary';
import { activityCompletionClient } from '../coins/ActivityCompletionClient';
import { ActivityStateRepository } from '../repositories/firestore/ActivityStateRepository';
import { authService } from '../auth/AuthService';

export function ChallengesPage() {
  const { data: dailyChallenge, error, loading } = useContentResource(loadDailyChallenge);
  const [verificationStatus, setVerificationStatus] = useState('idle');
  const [completed, setCompleted] = useState(false);
  const [completion, setCompletion] = useState({ pending: false, rewardStatus: null, rewardAmount: 0, error: null, streak: null });
  useEffect(() => {
    const user = authService.getCurrentUser();
    if (!user) return undefined;
    let active = true;
    new ActivityStateRepository(user.uid).getStreakSummary().then(
      (streak) => { if (active && streak) setCompletion((current) => ({ ...current, streak })); },
      () => {},
    );
    return () => { active = false; };
  }, []);
  const compilerBlock = useMemo(
    () => dailyChallenge?.blocks.find((block) => block.type === 'compiler') ?? null,
    [dailyChallenge],
  );
  const problemBlocks = useMemo(
    () => dailyChallenge?.blocks.filter((block) => block.type !== 'compiler') ?? [],
    [dailyChallenge],
  );
  const compiler = useMemo(() => compilerBlock ? createCompilerData(compilerBlock) : null, [compilerBlock]);
  const rewardReady = verificationStatus === 'matched';
  const currentStreak = completion.streak?.currentStreak ?? 0;
  const rewardMessage = {
    credited: `+${completion.rewardAmount} coins earned`,
    already_claimed: 'reward already claimed',
    daily_reward_cap_reached: 'daily reward cap reached',
    unavailable: 'reward reconciliation pending',
  }[completion.rewardStatus] ?? 'reward unavailable';
  const complete = async () => {
    setCompletion((current) => ({ ...current, pending: true, error: null }));
    try {
      const result = await activityCompletionClient.complete({ activityType: 'DAILY_CHALLENGE', activityId: dailyChallenge.id, activityVersion: dailyChallenge.version });
      setCompleted(['completed', 'already_completed'].includes(result.completionStatus));
      setCompletion({ pending: false, rewardStatus: result.rewardStatus, rewardAmount: result.rewardAmount ?? 0, error: null, streak: result.streak });
    } catch (nextError) {
      setCompletion((current) => ({ ...current, pending: false, error: nextError.message }));
    }
  };

  if (loading || error || !dailyChallenge || !compiler) {
    return (
      <div className="challenges-page">
        <header className="practice-page-heading">
          <h1>Daily Challenge</h1>
          <p>{error ? error.message : 'Loading today’s challenge…'}</p>
        </header>
      </div>
    );
  }

  return (
    <div className="challenges-page">
      <ChallengeHero
        challenge={dailyChallenge}
        streak={currentStreak}
        completed={completed}
      />

      <div className="challenge-summary-grid">
        <RewardSummary claimed={completed} rewardStatus={completion.rewardStatus} rewardAmount={completion.rewardAmount} />
        <CurrentStreak statistics={completion.streak ?? { currentStreak: 0, longestStreak: 0 }} completed={completed} />
      </div>

      <section className="today-challenge" aria-labelledby="today-challenge-title">
        <header className="challenge-section-heading">
          <div>
            <span>Today’s Challenge</span>
            <h2 id="today-challenge-title">{dailyChallenge.title}</h2>
            <p>{dailyChallenge.summary}</p>
          </div>
          <div className="challenge-metadata">
            <BookmarkToggle bookmark={createChallengeBookmark(dailyChallenge)} />
            <span className={`practice-difficulty is-${dailyChallenge.difficulty}`}>{dailyChallenge.difficulty}</span>
            <span>{dailyChallenge.language}</span>
            <span>{dailyChallenge.topic}</span>
            <span><Clock3 /> {dailyChallenge.estimatedMinutes} min</span>
          </div>
        </header>
        <div className="challenge-problem">
          <BlockRenderer
            lesson={{ id: dailyChallenge.id, blocks: problemBlocks }}
            emptyState={{ title: 'Challenge unavailable', description: 'Today’s challenge has no problem content.' }}
          />
        </div>
      </section>

      <section className="challenge-workspace" aria-labelledby="challenge-workspace-title">
        <header className="challenge-section-heading">
          <div>
            <span>Write and verify</span>
            <h2 id="challenge-workspace-title">Challenge Workspace</h2>
            <p>Run your current solution, inspect the output, then verify it against the expected result.</p>
          </div>
        </header>
        <div className="challenge-compiler">
          <DomainErrorBoundary
            name="challenge-compiler"
            title="The code workspace could not be displayed."
            description="Today’s challenge remains available. Retry the workspace to continue."
            resetKeys={[dailyChallenge.id]}
            compact
          >
            <CompilerPanel
              compiler={compiler}
              instanceId={`challenge-${dailyChallenge.id}`}
              lessonContext={dailyChallenge.title}
              activityType="challenge"
              onVerificationChange={setVerificationStatus}
              key={dailyChallenge.id}
            />
          </DomainErrorBoundary>
        </div>
        <footer className={`challenge-claim ${rewardReady || completed ? 'is-ready' : ''}`}>
          <span>
            {completed
              ? <CheckCircle2 />
              : rewardReady
                ? <Coins />
                : <LockKeyhole />}
            {completion.error
              ? completion.error
              : completed
              ? `Challenge completed · ${rewardMessage}`
              : rewardReady
                ? 'Output verified. You can mark this local solution complete.'
                : 'Check the correct output to complete this local solution.'}
          </span>
          <button
            className="button button--primary"
            type="button"
            disabled={!rewardReady || completed || completion.pending}
            onClick={complete}
          >
            {completed ? <CheckCircle2 /> : <Coins />}
            {completion.pending ? 'Saving…' : completed ? 'Completed' : 'Save Completion'}
          </button>
        </footer>
      </section>

      <ChallengeHistory history={challengeHistory} />
    </div>
  );
}
