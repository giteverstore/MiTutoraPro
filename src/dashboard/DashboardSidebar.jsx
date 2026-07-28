import { Code2, X } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { dashboardNavigation } from './dashboardData';
import { DashboardIcon } from './dashboardIcons';

export function DashboardSidebar({ activeItem, isOpen, onClose, onSelect }) {
  return (
    <>
      <button
        className={`dashboard-drawer-scrim ${isOpen ? 'is-visible' : ''}`}
        type="button"
        aria-label="Close dashboard navigation"
        onClick={onClose}
      />
      <aside className={`dashboard-sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="dashboard-brand">
          <span><Code2 size={ICON_SIZE.lg} /></span>
          <strong>MiTutora</strong>
          <button className="dashboard-mobile-close" type="button" aria-label="Close navigation" onClick={onClose}>
            <X size={ICON_SIZE.md} />
          </button>
        </div>
        <nav aria-label="Dashboard navigation">
          <span className="dashboard-nav-label">Workspace</span>
          {dashboardNavigation.map((item) => (
            <button
              className={`dashboard-nav-item ${activeItem === item.id ? 'is-active' : ''}`}
              type="button"
              aria-current={activeItem === item.id ? 'page' : undefined}
              onClick={() => onSelect(item)}
              key={item.id}
            >
              <DashboardIcon name={item.icon} size={ICON_SIZE.md} />
              <span>{item.label}</span>
              {item.comingSoon ? <small>Soon</small> : null}
            </button>
          ))}
        </nav>
        <div className="dashboard-sidebar-note">
          <span>Weekly goal</span>
          <strong>3 of 5 days</strong>
          <div><span /></div>
          <small>Two more sessions to build your streak.</small>
        </div>
      </aside>
    </>
  );
}
