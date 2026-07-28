import { ArrowUpRight } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { DashboardIcon } from './dashboardIcons';

export function CategoryGrid({ categories, activeCategory, onSelect }) {
  return (
    <section className="dashboard-section category-section" aria-labelledby="categories-title">
      <header className="dashboard-section-header">
        <div>
          <span className="eyebrow">Explore by interest</span>
          <h2 id="categories-title">Course categories</h2>
          <p>Find a focused path for your next learning goal.</p>
        </div>
      </header>
      <div className="category-grid">
        {categories.map((category) => (
          <button
            className={`category-card ${activeCategory === category.id ? 'is-active' : ''}`}
            type="button"
            aria-pressed={activeCategory === category.id}
            onClick={() => onSelect(category.id)}
            key={category.id}
          >
            <span className="category-icon"><DashboardIcon name={category.icon} size={ICON_SIZE.xl} /></span>
            <span>
              <strong>{category.label}</strong>
              <small>{category.description}</small>
              <em>{category.count} courses</em>
            </span>
            <ArrowUpRight size={ICON_SIZE.md} />
          </button>
        ))}
      </div>
    </section>
  );
}

