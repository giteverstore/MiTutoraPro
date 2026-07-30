import { Search } from 'lucide-react';

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'course', label: 'Courses' },
  { id: 'practice', label: 'Practice' },
  { id: 'challenge', label: 'Challenges' },
];

export function LibraryFilters({ activeTab, search, onTabChange, onSearchChange, counts }) {
  return (
    <div className="library-controls">
      <div className="library-tabs" role="tablist" aria-label="Bookmark types">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            key={tab.id}
          >
            {tab.label}<span>{counts[tab.id] ?? 0}</span>
          </button>
        ))}
      </div>
      <label className="library-search">
        <span className="sr-only">Search saved items</span>
        <Search aria-hidden="true" />
        <input
          type="search"
          value={search}
          placeholder="Search title, language, or topic"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
    </div>
  );
}
