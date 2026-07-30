import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Coins, LockKeyhole } from 'lucide-react';
import { BlockRenderer } from '../components/BlockRenderer';
import { CompilerPanel } from '../components/CompilerPanel';
import { createCompilerData } from '../components/blocks/CompilerBlock';
import { BookmarkToggle } from '../bookmarks/BookmarkToggle';
import { createChallengeBookmark } from '../bookmarks/bookmarkModel';
import { ChallengeHero } from './ChallengeHero';
import { ChallengeHistory } from './ChallengeHistory';
import { CurrentStreak, RewardSummary } from './ChallengeSummary';
import {
  challengeHistory,
  challengeStats,
  dailyChallenge,
} from './challengeData';

export function ChallengesPage() {
  const [verificationStatus, setVerificationStatus] = useState('idle');
  const [completed, setCompleted] = useState(false);
  const compilerBlock = useMemo(
    () => dailyChallenge.blocks.find((block) => block.type === 'compiler'),
    [],
  );
  const problemBlocks = useMemo(
    () => dailyChallenge.blocks.filter((block) => block.type !== 'compiler'),
    [],
  );
  const compiler = useMemo(() => createCompilerData(compilerBlock), [compilerBlock]);
  const rewardReady = verificationStatus === 'matched';
  const currentStreak = challengeStats.currentStreak
    + (completed ? dailyChallenge.reward.streakIncrement : 0);

  return (
    <div className="challenges-page">
      <ChallengeHero
        challenge={dailyChallenge}
        streak={currentStreak}
        completed={completed}
      />

      <div className="challenge-summary-grid">
        <RewardSummary reward={dailyChallenge.reward} claimed={completed} />
        <CurrentStreak statistics={challengeStats} completed={completed} />
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
          <CompilerPanel
            compiler={compiler}
            onVerificationChange={setVerificationStatus}
            key={dailyChallenge.id}
          />
        </div>
        <footer className={`challenge-claim ${rewardReady || completed ? 'is-ready' : ''}`}>
          <span>
            {completed
              ? <CheckCircle2 />
              : rewardReady
                ? <Coins />
                : <LockKeyhole />}
            {completed
              ? `Challenge completed · ${dailyChallenge.reward.coins} MI Coins claimed`
              : rewardReady
                ? 'Output verified. Your reward is ready.'
                : 'Check the correct output to unlock today’s reward.'}
          </span>
          <button
            className="button button--primary"
            type="button"
            disabled={!rewardReady || completed}
            onClick={() => setCompleted(true)}
          >
            {completed ? <CheckCircle2 /> : <Coins />}
            {completed ? 'Reward Claimed' : 'Claim Reward'}
          </button>
        </footer>
      </section>

      <ChallengeHistory history={challengeHistory} />
    </div>
  );
}
