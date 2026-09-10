import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Circle,
  LockKeyhole,
  Zap,
} from 'lucide-react';
import { BlockRenderer } from '../components/BlockRenderer';
import { CompilerPanel } from '../components/CompilerPanel';
import { createCompilerData } from '../components/blocks/CompilerBlock';
import { BookmarkToggle } from '../bookmarks/BookmarkToggle';
import { createPracticeBookmark } from '../bookmarks/bookmarkModel';
import { PracticeTestPanel } from './PracticeTestPanel';
import { DomainErrorBoundary } from '../errors/ErrorBoundary';

export function PracticeDetail({ question, solved, onBack, onComplete }) {
  const [verificationStatus, setVerificationStatus] = useState(solved ? 'matched' : 'idle');
  const [completion, setCompletion] = useState({ pending: false, rewardStatus: null, rewardAmount: 0, error: null });
  const compilerBlock = useMemo(
    () => question.blocks.find((block) => block.type === 'compiler'),
    [question],
  );
  const contentBlocks = useMemo(
    () => question.blocks.filter((block) => block.type !== 'compiler'),
    [question],
  );
  const compiler = useMemo(
    () => createCompilerData(compilerBlock),
    [compilerBlock],
  );
  const canComplete = verificationStatus === 'matched';
  const rewardMessage = {
    credited: `+${completion.rewardAmount} coins earned`,
    already_claimed: 'reward already claimed',
    daily_reward_cap_reached: 'daily reward cap reached',
    unavailable: 'reward reconciliation pending',
    daily_limit_reached: 'reward unavailable',
    activity_not_rewardable: 'reward unavailable',
    policy_disabled: 'reward unavailable',
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

  return (
    <div className="practice-detail">
      <header className="practice-detail-header">
        <div className="practice-detail-actions">
          <button className="practice-back-button" type="button" onClick={onBack}><ArrowLeft /> Back to Practice</button>
          <BookmarkToggle bookmark={createPracticeBookmark(question)} />
        </div>
        <div className="practice-detail-heading">
          <span>{question.language} · {question.topic}</span>
          <h1>{question.title}</h1>
          <p>{question.summary}</p>
          <div className="practice-detail-meta" aria-label="Question details">
            <span className={`practice-difficulty is-${question.difficulty}`}><Circle aria-hidden="true" /> {question.difficulty.replace('_', ' ')}</span>
            <span><Clock3 aria-hidden="true" /> {question.estimatedMinutes} min</span>
            <span><Zap aria-hidden="true" /> {question.xp} XP</span>
            <span className={solved ? 'is-solved' : ''}><CheckCircle2 aria-hidden="true" /> {solved ? 'Solved' : 'Unsolved'}</span>
          </div>
        </div>
      </header>
      <div className="practice-detail-grid">
        <article className="practice-problem">
          <BlockRenderer
            lesson={{ id: question.id, blocks: contentBlocks }}
            emptyState={{ title: 'Problem unavailable', description: 'This practice question has no problem content.' }}
          />
        </article>
        <section className="practice-workspace" aria-label="Code workspace">
          <DomainErrorBoundary
            name="practice-compiler"
            title="The code workspace could not be displayed."
            description="The problem statement is still available. Retry the workspace when you are ready."
            resetKeys={[question.id]}
            compact
          >
            <CompilerPanel
              compiler={compiler}
              instanceId={`practice-${question.id}`}
              lessonContext={question.title}
              activityType="practice"
              onVerificationChange={setVerificationStatus}
              renderOutput={(outputProps) => (
                <PracticeTestPanel
                  {...outputProps}
                  contract={question.contract}
                  tests={question.publicTests ?? []}
                />
              )}
              key={question.id}
            />
          </DomainErrorBoundary>
          <footer className={`practice-completion ${canComplete ? 'is-ready' : ''}`}>
            <span>
              {canComplete ? <CheckCircle2 /> : <LockKeyhole />}
              {completion.error
                ? completion.error
                : solved
                ? `Completed · ${rewardMessage}`
                : canComplete
                  ? 'Output verified. You can mark this local solution complete.'
                  : 'Run your solution and verify its output to continue.'}
            </span>
            <button className="button button--primary" type="button" disabled={!canComplete || solved || completion.pending} onClick={complete}>
              <CheckCircle2 /> {completion.pending ? 'Saving…' : solved ? 'Completed' : 'Save Completion'}
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
