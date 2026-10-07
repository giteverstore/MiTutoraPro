import { ProjectCatalog } from '../src/projects/repositories/ProjectCatalog.js';
import { readFile } from 'node:fs/promises';
import { normalizeLegacyDomainContent, normalizeLegacyProject } from '../shared/content/index.js';

const fallbackRuntimes = {
  python: { id: 'python', entrypoint: 'main.py', runCommand: 'python main.py', defaultFiles: [{ path: 'main.py', content: 'print("CLI Task Manager")\n' }] },
  javascript: { id: 'javascript', entrypoint: 'index.js', runCommand: 'node index.js', defaultFiles: [{ path: 'index.js', content: 'console.log("CLI Task Manager");\n' }] },
  java: { id: 'java', entrypoint: 'Main.java', runCommand: 'java Main.java', defaultFiles: [{ path: 'Main.java', content: 'public class Main {}\n' }] },
  cpp: { id: 'cpp', entrypoint: 'main.cpp', runCommand: './main', defaultFiles: [{ path: 'main.cpp', content: 'int main() { return 0; }\n' }] },
};
const resolveRuntime = (_project, language) => fallbackRuntimes[language];

const projects = new ProjectCatalog().getProjects();
for (const project of projects) normalizeLegacyProject(project, { resolveRuntime });
const domainFixtures = [
  ['COURSE', 'firebase-content/course-content/python/v2/course.json'],
  ['PRACTICE', 'firebase-content/practice/python/v2/question-1.json'],
  ['CHALLENGE', 'firebase-content/daily-challenges/python/v1/2026-08-01.json'],
];
for (const [contentType, path] of domainFixtures) {
  const content = JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  normalizeLegacyDomainContent({ contentId: `compat-${contentType.toLowerCase()}`, contentType, content, metadata: { fixturePath: path } });
}
process.stdout.write(`Content contract validation passed for ${projects.length} legacy Projects and ${domainFixtures.length} existing domain fixtures.\n`);
