import { describe, expect, it } from 'vitest';
import { createPublishedFirstPracticeSource } from '../../src/practice/practiceContentSource.js';

const question = (id, topic, difficulty = 'easy', language = 'python') => ({ id, title: id, summary: '', topic, difficulty, language, category: 'Programming', skills: [], version: 1 });
const source = (items) => ({
  listCatalog: async () => items,
  loadQuestion: async (item) => item,
  loadQuestionById: async (id) => items.find((item) => item.id === id),
});

describe('canonical Practice catalog migration', () => {
  it('keeps legacy questions browsable while a canonical publication replaces matching IDs', async () => {
    const merged = createPublishedFirstPracticeSource({
      canonical: source([question('new', 'Strings'), question('replaced', 'Strings')]),
      legacy: source([question('old', 'Math'), question('replaced', 'Math')]),
    });
    expect((await merged.listCatalog()).map(({ id }) => id)).toEqual(['new', 'replaced', 'old']);
    expect((await merged.listPage({ filters: { topic: 'Math' } })).items.map(({ id }) => id)).toEqual(['old']);
    expect((await merged.loadQuestionById('replaced')).topic).toBe('Strings');
    expect((await merged.loadQuestionById('old')).topic).toBe('Math');
  });
  it('filters the mixed catalog by language, difficulty, topic, and search without duplicating canonical IDs', async () => {
    const merged = createPublishedFirstPracticeSource({
      canonical: source([question('python-strings', 'Strings'), question('replaced', 'Strings')]),
      legacy: source([question('java-math', 'Math', 'medium', 'java'), question('replaced', 'Math', 'hard', 'java')]),
    });
    expect((await merged.listPage({ filters: { language: 'python' } })).items.map(({ id }) => id)).toEqual(['python-strings', 'replaced']);
    expect((await merged.listPage({ filters: { language: 'java', difficulty: 'medium', topic: 'Math', search: 'java-math' } })).items.map(({ id }) => id)).toEqual(['java-math']);
    expect((await merged.listCatalog()).filter(({ id }) => id === 'replaced')).toHaveLength(1);
  });
});
