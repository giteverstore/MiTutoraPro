export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Loading dashboard" aria-busy="true">
      <span className="skeleton-line skeleton-short" />
      <span className="skeleton-line skeleton-title" />
      <span className="skeleton-card dashboard-skeleton-hero" />
      <div className="dashboard-skeleton-row">
        {Array.from({ length: 4 }, (_, index) => <span className="skeleton-card" key={index} />)}
      </div>
    </div>
  );
}

