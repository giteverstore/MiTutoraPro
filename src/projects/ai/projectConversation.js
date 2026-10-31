const QUESTION_LIMIT = 2_000;
const ANSWER_LIMIT = 5_000;
const TURN_LIMIT = 3;
const TOTAL_LIMIT = 6_000;

function timestamp(value) {
  const parsed = typeof value === 'number' ? value : Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function fragment(item) {
  const requestId = item?.requestId ?? item?.id;
  if (!requestId) return null;
  if (item?.question !== undefined || item?.answer !== undefined) {
    return { ...item, id: requestId, requestId };
  }
  return {
    id: requestId,
    requestId,
    createdAt: item?.createdAt,
    ...(item?.role === 'user' ? { question: item.text } : {}),
    ...(item?.role === 'assistant' ? { answer: item.response?.answer ?? item.response?.summary ?? '' } : {}),
  };
}

export function reconcileProjectTurns(current = [], historyItems = []) {
  const turns = new Map();
  let sequence = 0;
  const merge = (turn) => {
    if (!turn?.id) return;
    const existing = turns.get(turn.id);
    const existingTime = timestamp(existing?.turn.createdAt);
    const nextTime = timestamp(turn.createdAt);
    turns.set(turn.id, {
      sequence: existing?.sequence ?? (sequence += 1),
      turn: {
        ...existing?.turn,
        ...turn,
        id: turn.id,
        requestId: turn.requestId ?? existing?.turn.requestId ?? turn.id,
        createdAt: existingTime != null && nextTime != null
          ? Math.min(existingTime, nextTime)
          : existing?.turn.createdAt ?? turn.createdAt,
      },
    });
  };
  current.forEach(merge);
  historyItems.map(fragment).forEach(merge);
  return [...turns.values()].sort((left, right) => {
    const leftTime = timestamp(left.turn.createdAt);
    const rightTime = timestamp(right.turn.createdAt);
    if (leftTime != null && rightTime != null && leftTime !== rightTime) return leftTime - rightTime;
    if (leftTime != null && rightTime == null) return -1;
    if (leftTime == null && rightTime != null) return 1;
    return left.sequence - right.sequence || left.turn.id.localeCompare(right.turn.id);
  }).map(({ turn }) => turn);
}

export function projectProviderConversation(turns = []) {
  const complete = turns.filter((turn) => {
    const question = typeof turn?.question === 'string' ? turn.question.trim() : '';
    const answer = typeof turn?.answer === 'string' ? turn.answer.trim() : '';
    return question && question.length <= QUESTION_LIMIT && answer && answer.length <= ANSWER_LIMIT;
  }).slice(-TURN_LIMIT);
  const retained = [];
  let characters = 0;
  for (let index = complete.length - 1; index >= 0; index -= 1) {
    const turn = complete[index];
    const question = turn.question.trim();
    const answer = turn.answer.trim();
    if (characters + question.length + answer.length > TOTAL_LIMIT) break;
    retained.unshift(Object.freeze({ question, answer }));
    characters += question.length + answer.length;
  }
  return Object.freeze(retained);
}
