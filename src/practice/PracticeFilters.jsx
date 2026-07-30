import { Search } from 'lucide-react';

function SelectFilter({ label, value, options, onChange }) {
  return (
    <label className="practice-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((option) => <option value={option} key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export function PracticeFilters({ filters, options, onChange }) {
  return (
    <div className="practice-filters" aria-label="Practice question filters">
      <label className="practice-search">
        <span>Search</span>
        <div><Search aria-hidden="true" /><input type="search" value={filters.search} placeholder="Search questions" onChange={(event) => onChange('search', event.target.value)} /></div>
      </label>
      <SelectFilter label="Difficulty" value={filters.difficulty} options={options.difficulties} onChange={(value) => onChange('difficulty', value)} />
      <SelectFilter label="Topic" value={filters.topic} options={options.topics} onChange={(value) => onChange('topic', value)} />
    </div>
  );
}
