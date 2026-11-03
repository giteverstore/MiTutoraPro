import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/pages/projects.css', 'utf8');
const component = readFileSync('src/projects/components/ProjectContextualAIConversation.jsx', 'utf8');

describe('Project AI compact composer', () => {
  it('uses a compact aligned textarea and Send control', () => {
    expect(css).toMatch(/\.project-ai-composer textarea\s*\{[^}]*min-height:\s*2\.875rem;[^}]*max-height:\s*8rem;/s);
    expect(css).toMatch(/\.project-ai-composer button,\.project-ai-suggest\s*\{[^}]*min-height:\s*2\.875rem;/s);
    expect(css).toContain('@media (max-width: 390px) { .project-ai-composer { grid-template-columns: 1fr; }.project-ai-composer button { width: 100%; } }');
  });

  it('removes the live remaining counter without removing the exhausted message', () => {
    expect(component).not.toContain('AI messages remaining');
    expect(component).not.toContain('project-ai-usage');
    expect(component).toContain('Daily AI limit reached. Try again tomorrow.');
    expect(component).toContain("usage?.remainingMessages === 0");
  });
});
