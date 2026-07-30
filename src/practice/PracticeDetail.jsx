import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, LockKeyhole } from 'lucide-react';
import { BlockRenderer } from '../components/BlockRenderer';
import { CompilerPanel } from '../components/CompilerPanel';
import { createCompilerData } from '../components/blocks/CompilerBlock';
import { BookmarkToggle } from '../bookmarks/BookmarkToggle';
import { createPracticeBookmark } from '../bookmarks/bookmarkModel';

export function PracticeDetail({ question, solved, onBack, onComplete }) {
  const [verificationStatus, setVerificationStatus] = useState(solved ? 'matched' : 'idle');
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

  return (
    <div className="practice-detail">
      <header className="practice-detail-header">
        <div className="practice-detail-actions">
          <button className="practice-back-button" type="button" onClick={onBack}><ArrowLeft /> Back to Practice</button>
          <BookmarkToggle bookmark={createPracticeBookmark(question)} />
        </div>
        <div>
          <span>{question.language} · {question.topic}</span>
          <h1>{question.title}</h1>
          <p>{question.summary}</p>
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
          <CompilerPanel
            compiler={compiler}
            onVerificationChange={setVerificationStatus}
            key={question.id}
          />
          <footer className={`practice-completion ${canComplete ? 'is-ready' : ''}`}>
            <span>
              {canComplete ? <CheckCircle2 /> : <LockKeyhole />}
              {solved
                ? 'This question is solved. You can verify another solution.'
                : canComplete
                  ? 'Output verified. You can complete this question.'
                  : 'Run your solution and verify its output to continue.'}
            </span>
            <button className="button button--primary" type="button" disabled={!canComplete || solved} onClick={() => onComplete(question.id)}>
              <CheckCircle2 /> {solved ? 'Completed' : 'Mark Complete'}
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
