export function LessonSkeleton() {
  return (
    <div className="lesson-document skeleton-document" role="status" aria-label="Loading lesson">
      <span className="skeleton-line skeleton-short" />
      <span className="skeleton-line skeleton-title" />
      <span className="skeleton-line skeleton-medium" />
      <div className="skeleton-section">
        <span className="skeleton-line skeleton-heading" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line skeleton-medium" />
      </div>
      <div className="skeleton-card" />
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="sidebar-skeleton" role="status" aria-label="Loading course modules">
      {[1, 2, 3, 4, 5].map((item) => (
        <span className="skeleton-line" key={item} />
      ))}
    </div>
  );
}
