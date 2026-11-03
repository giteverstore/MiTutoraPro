import { Search } from 'lucide-react';
import { LearnerSelect } from '../components/LearnerSelect';

function SelectFilter({ label, value, options, onChange, includeAll = true }) {
  return (
    <label className="practice-filter">
      <span>{label}</span>
      <LearnerSelect ariaLabel={label} value={value} onChange={onChange} options={[
        ...(includeAll ? [{ value: 'all', label: `All ${label === 'Difficulty' ? 'Difficulties' : label === 'Topic' ? 'Topics' : label.toLowerCase()}` }] : []),
        ...options.map((option) => {
          const id = typeof option === 'string' ? option : option.id;
          const text = typeof option === 'string' ? option.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : option.label;
          return { value: id, label: text };
        }),
      ]} />
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
      <SelectFilter label="Language" value={filters.language} options={options.languages} includeAll={false} onChange={(value) => onChange('language', value)} />
      <SelectFilter label="Difficulty" value={filters.difficulty} options={options.difficulties} onChange={(value) => onChange('difficulty', value)} />
      <SelectFilter label="Topic" value={filters.topic} options={options.topics} onChange={(value) => onChange('topic', value)} />
      <div className="practice-topic-chips" aria-label="Topic filters">
        <button type="button" className={filters.topic === 'all' ? 'is-active' : ''} aria-pressed={filters.topic === 'all'} onClick={() => onChange('topic', 'all')}>All Topics</button>
        {options.topics.map((topic) => <button type="button" className={filters.topic === topic ? 'is-active' : ''} aria-pressed={filters.topic === topic} onClick={() => onChange('topic', topic)} key={topic}>{topic}</button>)}
      </div>
    </div>
  );
}
