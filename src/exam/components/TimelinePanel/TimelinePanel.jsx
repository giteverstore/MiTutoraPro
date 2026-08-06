import { CheckCircle2, CircleAlert } from 'lucide-react';
import { INTEGRITY_EVENT_STATUS } from '../../models/IntegrityEvent';

function formatType(type) {
  return type.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export function TimelinePanel({ timeline }) {
  return <section className="monitor-section monitoring-timeline" aria-labelledby="monitoring-timeline-title"><h3 id="monitoring-timeline-title">Timeline <span>{timeline.length}</span></h3>{timeline.length ? <ol>{timeline.map((event) => <li key={event.id}>{event.status === INTEGRITY_EVENT_STATUS.ACTIVE ? <CircleAlert /> : <CheckCircle2 />}<div><strong>{formatType(event.type)}</strong><small>{new Date(event.startedAt).toLocaleTimeString()} · {event.status.toLowerCase()} · {Math.ceil(event.duration / 1000)}s</small></div></li>)}</ol> : <div className="monitor-empty">No events recorded</div>}</section>;
}
