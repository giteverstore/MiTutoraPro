import { ArrowUpRight, BookOpen, Star, Trophy } from 'lucide-react';
import { BookmarkToggle } from './BookmarkToggle';

const typeDetails = {
  course: { label: 'Course Lesson', icon: BookOpen },
  practice: { label: 'Practice Question', icon: Star },
  challenge: { label: 'Daily Challenge', icon: Trophy },
};

const courseLanguageIcons = Object.freeze({
  python: '/assets/languages/python.svg',
  java: '/assets/languages/java.svg',
});

export function courseBookmarkIcon(bookmark) {
  if (bookmark.type !== 'course') return null;
  const candidates = [bookmark.language, bookmark.target?.courseId];
  const language = candidates
    .map((value) => String(value ?? '').trim().toLowerCase())
    .find((value) => courseLanguageIcons[value]);
  return language ? courseLanguageIcons[language] : null;
}

export function SavedItemCard({ bookmark, onOpen }) {
  const detail = typeDetails[bookmark.type];
  const Icon = detail.icon;
  const contextualIcon = courseBookmarkIcon(bookmark);
  return (
    <article className="saved-item-card">
      <div className={`saved-item-icon is-${bookmark.type}${contextualIcon ? ' has-context-icon' : ''}`}>
        {contextualIcon ? <img src={contextualIcon} alt="" aria-hidden="true" /> : <Icon aria-hidden="true" />}
      </div>
      <div className="saved-item-copy">
        <span>{detail.label}</span>
        <h3><button type="button" onClick={() => onOpen(bookmark)}>{bookmark.title}</button></h3>
        <p>{bookmark.description || 'Saved learning content'}</p>
        <div>{bookmark.language ? <span>{bookmark.language}</span> : null}{bookmark.topic ? <span>{bookmark.topic}</span> : null}</div>
      </div>
      <div className="saved-item-actions">
        <BookmarkToggle bookmark={bookmark} iconOnly />
        <button className="button button--secondary" type="button" onClick={() => onOpen(bookmark)}>
          Open <ArrowUpRight />
        </button>
      </div>
    </article>
  );
}
