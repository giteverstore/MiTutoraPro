import { LibraryBig } from 'lucide-react';

export function LibraryEmptyState({ filtered, onClear }) {
  return (
    <div className="library-empty-state" role="status">
      <span><LibraryBig aria-hidden="true" /></span>
      <h2>{filtered ? 'No saved items match' : 'Your Library is ready'}</h2>
      <p>{filtered
        ? 'Try another search or view all bookmark types.'
        : ''}</p>
      {filtered ? <button className="button button--secondary" type="button" onClick={onClear}>Clear filters</button> : null}
    </div>
  );
}
