import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/pages/projects.css', 'utf8');

describe('Project Guide content-fit contract', () => {
  it('keeps the Guide mode and content column shrinkable without outer horizontal scrolling', () => {
    expect(css).toMatch(/\.project-guide-mode\.is-active\s*\{[^}]*min-width:\s*0;[^}]*grid-template-columns:\s*minmax\(0,1fr\);/s);
    expect(css).toMatch(/\.project-guide-content\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/\.project-structured-guide\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*grid-template-columns:\s*minmax\(0,1fr\);/s);
  });

  it('wraps ordinary headings, paragraphs, list items, descriptions, and captions', () => {
    expect(css).toMatch(/\.project-guide-content\s+:where\(h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption\)\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;[^}]*word-break:\s*normal;/s);
    expect(css).toMatch(/\.project-guide-content ul,\.project-guide-content ol\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*box-sizing:\s*border-box;/s);
  });

  it('constrains diagrams and tables to the pane width', () => {
    expect(css).toMatch(/\.project-guide-source-image img\s*\{[^}]*height:\s*auto;[^}]*max-width:\s*100%;/s);
    expect(css).toMatch(/\.project-guide-content \.content-table-scroll table\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*table-layout:\s*fixed;/s);
    expect(css).toMatch(/\.project-guide-content \.content-table-scroll td\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/s);
    expect(css).toMatch(/\.project-guide-content \.content-table-scroll\.is-label-pair :is\(th,td\)\s*\{\s*min-width:\s*0;/s);
  });

  it('localizes genuinely wide preformatted content to its own scroller', () => {
    expect(css).toMatch(/\.project-guide-content pre\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto;[^}]*white-space:\s*pre;/s);
    expect(css).toMatch(/\.project-guide-output\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*box-sizing:\s*border-box;/s);
  });
});
