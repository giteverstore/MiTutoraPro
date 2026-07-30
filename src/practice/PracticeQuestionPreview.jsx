import { ArrowRight, CheckCircle2, Clock3, Zap } from 'lucide-react';
import { BookmarkToggle } from '../bookmarks/BookmarkToggle';
import { createPracticeBookmark } from '../bookmarks/bookmarkModel';

export function PracticeQuestionPreview({ question, solved, onStart }) {
  if (!question) {
    return <aside className="practice-preview is-empty"><p>No questions match these filters.</p></aside>;
  }
  return (
    <aside className="practice-preview" aria-labelledby="practice-preview-title">
      <div className="practice-preview-top">
        <span className={`practice-difficulty is-${question.difficulty}`}>{question.difficulty}</span>
        <div className="practice-preview-actions">
          {solved ? <span className="practice-preview-solved"><CheckCircle2 /> Solved</span> : null}
          <BookmarkToggle bookmark={createPracticeBookmark(question)} iconOnly />
        </div>
      </div>
      <span className="practice-preview-topic">{question.language} · {question.topic}</span>
      <h2 id="practice-preview-title">{question.title}</h2>
      <p>{question.summary}</p>
      <div className="practice-preview-meta">
        <span><Clock3 /> {question.estimatedMinutes} minutes</span>
        <span><Zap /> {question.xp} XP</span>
      </div>
      <button className="button button--primary" type="button" onClick={onStart}>
        {solved ? 'Practice Again' : 'Start Practice'} <ArrowRight />
      </button>
    </aside>
  );
}
