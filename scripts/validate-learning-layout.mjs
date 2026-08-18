import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CourseCompletionEngine } from '../functions/src/certification/CourseCompletionEngine.js';
import { findLessonProgressScope } from '../src/course/courseStructure.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [course, layout, sidebar, contentArea, footer, styles, completionContext, completionService] = await Promise.all([
  read('public/courses/python-course.json').then(JSON.parse),
  read('src/components/Layout.jsx'),
  read('src/components/Sidebar.jsx'),
  read('src/components/ContentArea.jsx'),
  read('src/components/LessonFooter.jsx'),
  read('src/styles.css'),
  read('src/progress/LearningProgressContext.jsx'),
  read('functions/src/certification/CourseCompletionService.js'),
]);

assert.match(layout, /<section className="lesson-region"[\s\S]*?<ContentArea[\s\S]*?<LessonFooter[\s\S]*?<\/section>/, 'The bounded lesson region must own its scroll area and navigation.');
assert.doesNotMatch(contentArea, /<LessonFooter/, 'Lesson navigation must not scroll inside lesson content.');
assert.match(contentArea, /data-lesson-end=\{lesson\.id\}/, 'Reading completion requires an in-content end sentinel.');
assert.match(footer, /data-lesson-end[\s\S]*IntersectionObserver/, 'Reading completion must observe the lesson end rather than the fixed footer.');
assert.match(styles, /\.lesson-region\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto;[\s\S]*?min-height:\s*0;/, 'Desktop lesson content and navigation must share one bounded grid column.');
assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*?\.lesson-region\s*\{\s*grid-column:\s*1;/, 'Overlay-sidebar layouts must keep the lesson region in the content column.');
assert.match(styles, /\.lesson-panel\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/, 'Only the lesson content row may scroll.');
assert.doesNotMatch(styles, /lesson-navigation-dock/, 'The former competing workspace navigation grid item must not remain.');
assert.match(styles, /\.lesson-body\s*\{[^}]*gap:\s*var\(--space-5\)/, 'Lesson blocks must use a shared spacing rhythm.');
assert.match(layout, /isOverlay=\{isSidebarOverlay\}/, 'The sidebar must receive the existing responsive layout mode.');
assert.match(layout, /setIsSidebarOverlay\(matches\);\s*setIsDrawerOpen\(false\);/, 'Changing layout modes must dismiss stale drawer state.');
assert.match(sidebar, /\{isOverlay \? \([\s\S]*?className="drawer-close"[\s\S]*?\) : \([\s\S]*?className="sidebar-collapse-button"/, 'Drawer close and desktop collapse controls must be mutually exclusive.');

const completion = new CourseCompletionEngine();
const requirements = completion.requirements(course);
const lessons = course.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons));
const lessonFour = lessons[3];
for (const section of course.modules[0].sections) {
  const firstScope = findLessonProgressScope(course, section.lessons[0].id);
  const lastScope = findLessonProgressScope(course, section.lessons.at(-1).id);
  assert.equal(firstScope.id, section.id);
  assert.equal(firstScope.index, 0);
  assert.equal(firstScope.lessons.length, section.lessons.length);
  assert.equal(lastScope.index, section.lessons.length - 1);
}
const legacyCourse = { modules: [{ id: 'legacy-module', title: 'Legacy module', lessons: [{ id: 'legacy-lesson' }] }] };
assert.equal(findLessonProgressScope(legacyCourse, 'legacy-lesson').title, 'Legacy module', 'Direct module lessons require a graceful progress fallback.');
assert.equal(requirements.courseId, 'python');
assert.equal(requirements.lessonIds.length, 109, 'Trusted completion must traverse all section-owned Python lessons.');
assert.match(lessonFour.id, /^lesson-1-4-quiz-/, 'Lesson 4 must resolve to the published print-syntax quiz lesson.');
assert.equal(lessonFour.blocks.some(({ type }) => type === 'quiz'), true, 'Lesson 4 must preserve its quiz verification requirement.');
assert.equal(requirements.lessonIds.includes(lessonFour.id), true, 'Trusted completion must recognize lesson 4 in the sectioned manifest.');
assert.match(completionContext, /await trustedCompletionService\.recordLessonCompletion[\s\S]*?updateProgress/, 'Local completion must remain fail-closed behind trusted recording.');
assert.doesNotMatch(completionService, /CertificateIssuer|issueCertificate|createExamAttempt/, 'Ordinary lesson completion must not issue a certificate or exam attempt.');

console.log(JSON.stringify({
  fixedNavigation: 'passed',
  responsiveGridAlignment: 'passed',
  responsiveSidebarControls: 'passed',
  lessonEndDetection: 'passed',
  lessonFour: lessonFour.id,
  sectionProgressScopes: course.modules[0].sections.length,
  trustedLessons: requirements.lessonIds.length,
  accidentalCertificateIssuance: false,
}, null, 2));
