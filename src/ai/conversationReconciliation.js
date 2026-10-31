export function createConversationRequestId(prefix = 'tutor') {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function timestamp(value) {
  const parsed = typeof value === 'number' ? value : Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

export function reconcileConversation(current = [], persisted = []) {
  const entries = new Map();
  let sequence = 0;
  for (const item of current) {
    if (item?.id) entries.set(item.id, { item, sequence: sequence += 1 });
  }
  for (const item of persisted) {
    if (!item?.id) continue;
    const existing = entries.get(item.id);
    entries.set(item.id, { item, sequence: existing?.sequence ?? (sequence += 1) });
  }
  return [...entries.values()].sort((left, right) => {
    const leftTime = timestamp(left.item.createdAt);
    const rightTime = timestamp(right.item.createdAt);
    if (leftTime != null && rightTime != null && leftTime !== rightTime) return leftTime - rightTime;
    if (leftTime != null && rightTime == null) return -1;
    if (leftTime == null && rightTime != null) return 1;
    return left.sequence - right.sequence || left.item.id.localeCompare(right.item.id);
  }).map(({ item }) => item);
}
