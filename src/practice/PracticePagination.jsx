import { ChevronLeft, ChevronRight } from 'lucide-react';

const MAX_VISIBLE_PAGES = 3;

export function getVisiblePracticePages(currentPage, reachablePageCount, maxVisible = MAX_VISIBLE_PAGES) {
  const visibleCount = Math.min(maxVisible, reachablePageCount);
  const firstPage = Math.min(
    Math.max(1, currentPage - Math.floor(visibleCount / 2)),
    Math.max(1, reachablePageCount - visibleCount + 1),
  );
  return Array.from({ length: visibleCount }, (_, index) => firstPage + index);
}

export function PracticePagination({ currentPage, reachablePageCount, hasNextPage, onPageChange }) {
  const visiblePages = getVisiblePracticePages(currentPage, reachablePageCount);

  return (
    <nav className="practice-pagination" aria-label="Practice catalog pages">
      <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        <ChevronLeft aria-hidden="true" />
        <span>Previous</span>
      </button>
      <div aria-label="Available pages">
        {visiblePages.map((pageNumber) => (
          <button
            className={pageNumber === currentPage ? 'is-active' : ''}
            type="button"
            aria-label={`Page ${pageNumber}`}
            aria-current={pageNumber === currentPage ? 'page' : undefined}
            onClick={() => onPageChange(pageNumber)}
            key={pageNumber}
          >
            {pageNumber}
          </button>
        ))}
      </div>
      <button type="button" aria-label="Next page" disabled={!hasNextPage} onClick={() => onPageChange(currentPage + 1)}>
        <span>Next</span>
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
}
