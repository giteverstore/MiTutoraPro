import { ArrowUpRight, BadgeCheck, Info, Lightbulb } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';

const toneIcons = {
  info: Info,
  tip: Lightbulb,
  success: BadgeCheck,
};

export function CalloutBlock({ tone, title, content, action }) {
  if (tone === 'info' && title === 'Next step') {
    return (
      <section className="content-section reading-copy lesson-text-block lesson-action-cta">
        <p><strong>{content}</strong></p>
      </section>
    );
  }

  const ToneIcon = toneIcons[tone] ?? Info;

  return (
    <aside className={`card card--accent content-section callout-card is-${tone}`}>
      <span className="callout-icon"><ToneIcon size={ICON_SIZE.md} aria-hidden="true" /></span>
      <div>
        <strong>{title}</strong>
        <p>{content}</p>
        {action ? (
          <a className="callout-action" href={action.href}>
            {action.label} <ArrowUpRight size={ICON_SIZE.sm} />
          </a>
        ) : null}
      </div>
    </aside>
  );
}
