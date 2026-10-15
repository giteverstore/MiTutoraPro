import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlignLeft, BookOpen, Braces, ChevronDown, ChevronRight, Code2, Heading2, Image, List, ListChecks, MessageSquareWarning, MoreVertical, Plus, Table2, Trash2 } from 'lucide-react';
import { COURSE_LANGUAGE_IDS } from '../../../../../shared/content/index.js';
import { CloudDraftRepository } from '../persistence/CloudDraftRepository.js';
import { LocalDraftRepository } from '../persistence/DraftRepository.js';
import { useAutosavedDraft } from '../persistence/useAutosavedDraft.js';
import { ProjectPublicationPanel } from '../projects/ProjectPublicationPanel.jsx';
import { AssetPicker } from '../../publishing/AssetPicker.jsx';
import { AssetPreview } from '../../publishing/AssetsPage.jsx';
import { StudioHeader, StudioWorkspace } from '../StudioChrome.jsx';
import { StudioDraftList } from '../StudioDraftList.jsx';
import { StudioListHeader, StudioListState, useStudioList } from '../StudioListState.jsx';
import { BlockPalette } from '../blocks/BlockPalette.jsx';
import { BlockCanvas } from '../blocks/BlockCanvas.jsx';
import { useLegacyBlockWorkspace } from '../blocks/useLegacyBlockWorkspace.js';
import { LegacyBlockInspector } from '../inspector/LegacyBlockInspector.jsx';
import { countCourseLessons, courseLessons, courseUid, createCourseDraft, newCourseLesson, newCourseModule, newCourseSection, reindexCourse, validateCourseDraft } from './courseAuthoring.js';
import '../projects/project-studio.css';

const local = globalThis.localStorage?.getItem ? globalThis.localStorage : null;
const repository = import.meta.env.MODE === 'test' || import.meta.env.VITE_ADMIN_DRAFT_MODE === 'local' ? new LocalDraftRepository(local, 'ycoders.admin.course-draft.v1') : new CloudDraftRepository('COURSE');
const Field = ({ label, ...props }) => <label><span>{label}</span>{label === 'Options (one per line; first is correct)' ? <textarea {...props} /> : <input {...props} />}</label>;
const Lines = ({ label, value = [], onChange, readOnly }) => <label><span>{label}</span><textarea value={value.join('\n')} readOnly={readOnly} onChange={(event) => onChange(event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))} /></label>;
const move = (items, index, delta) => { const target = index + delta; if (target < 0 || target >= items.length) return items; const copy = [...items]; [copy[index], copy[target]] = [copy[target], copy[index]]; return reindexCourse(copy); };
const coursePalette = [
  ['heading', 'Heading', Heading2, 'Content'], ['paragraph', 'Paragraph', AlignLeft, 'Content'], ['list', 'List', List, 'Content'], ['code', 'Code', Code2, 'Content'],
  ['quiz', 'Quiz', ListChecks, 'Learning'], ['compiler', 'Compiler Exercise', Code2, 'Learning'], ['expected-output', 'Expected Output', Code2, 'Learning'], ['exercise', 'Exercise', ListChecks, 'Learning'], ['solution', 'Solution', Code2, 'Learning'],
  ['image', 'Image', Image, 'Media'], ['table', 'Table', Table2, 'Media'],
  ['note', 'Note', MessageSquareWarning, 'Callouts'], ['callout', 'Callout', MessageSquareWarning, 'Callouts'], ['warning', 'Warning', MessageSquareWarning, 'Callouts'],
].map(([type, label, icon, group]) => ({ type, label, icon, group }));

function CoursesLanding({ onNavigate }) {
  const resource = useStudioList(useCallback(() => repository.list().then((all) => all.filter((item) => item.contentType === 'COURSE')), []));
  return <section className="project-landing"><StudioListHeader title="Courses" description="Author and manage your Courses." action={<button className="admin-primary-button" type="button" onClick={() => onNavigate('/content/courses/new')}><Plus />New Course</button>} /><StudioListState resource={resource} label="Courses" empty="No Course drafts yet."><StudioDraftList drafts={resource.items} type="Course" detail={(draft) => `${draft.content.language === 'none' ? 'Non-programming' : draft.content.language} · ${countCourseLessons(draft.content)} lessons`} onOpen={(draft) => onNavigate(`/content/courses/${draft.contentId}/edit`)} /></StudioListState></section>;
}

export function CourseStudio({ path, role, readOnly, onNavigate, onDirtyChange = () => {} }) {
  if (path === '/content/courses') return <CoursesLanding onNavigate={onNavigate} />;
  const routeId = path.match(/\/courses\/([^/]+)\/edit/)?.[1];
  return <CourseEditor key={routeId ?? 'new'} routeId={routeId} role={role} readOnly={readOnly} onDirtyChange={onDirtyChange} />;
}

function CourseEditor({ routeId, role, readOnly, onDirtyChange }) {
  const { draft, dirty, saveError, edit, reload } = useAutosavedDraft({ routeId, createDraft: createCourseDraft, repository, readOnly, onDirtyChange });
  const [selected, setSelected] = useState({ type: 'overview' });
  const [pendingBlockSelection, setPendingBlockSelection] = useState(null);
  const [view, setView] = useState('author');
  const [validation, setValidation] = useState(null);
  const content = draft.content;
  const module = content.modules.find((item) => item.id === selected.moduleId);
  const section = module?.sections?.find((item) => item.id === selected.sectionId);
  const lesson = module && courseLessons(module).find((item) => item.id === selected.lessonId);
  const update = (fn) => { if (readOnly) return; edit((current) => ({ ...current, content: fn(structuredClone(current.content)) })); setValidation(null); };
  const patchContent = (patch) => update((value) => Object.assign(value, patch));
  const patchModule = (patch) => update((value) => { Object.assign(value.modules.find((item) => item.id === selected.moduleId), patch); return value; });
  const patchSection = (patch) => update((value) => { Object.assign(value.modules.find((item) => item.id === selected.moduleId).sections.find((item) => item.id === selected.sectionId), patch); return value; });
  const patchLesson = (patch) => update((value) => { const owner = value.modules.find((item) => item.id === selected.moduleId); Object.assign(courseLessons(owner).find((item) => item.id === selected.lessonId), patch); return value; });
  const json = useMemo(() => JSON.stringify({ ...draft, documentId: undefined, draftRevision: undefined }, null, 2), [draft]);
  const addModule = () => update((value) => { const next = newCourseModule(value.modules.length + 1); value.modules.push(next); setSelected({ type: 'module', moduleId: next.id }); return value; });
  const addLesson = (moduleId, sectionId) => update((value) => { const found = value.modules.find((item) => item.id === moduleId); const target = sectionId ? found.sections.find((item) => item.id === sectionId).lessons : found.lessons; const next = newCourseLesson((target.at(-1)?.order ?? 0) + 1); target.push(next); setSelected({ type: 'lesson', moduleId, lessonId: next.id }); return value; });
  const addSection = (moduleId) => update((value) => {
    const owner = value.modules.find((item) => item.id === moduleId);
    if (!owner.sections) {
      owner.sections = [{ id: courseUid('section'), order: 1, title: 'Section 1', description: '', initiallyExpanded: true, lessons: owner.lessons }];
      delete owner.lessons;
    }
    const next = newCourseSection(owner.sections.length + 1);
    owner.sections.push(next);
    setSelected({ type: 'section', moduleId, sectionId: next.id });
    return value;
  });
  const blocks = useLegacyBlockWorkspace({ scopeId: lesson?.id, blocks: lesson?.blocks ?? [], setBlocks: (next) => patchLesson({ blocks: next }), makeId: courseUid });
  useEffect(() => {
    if (!pendingBlockSelection || pendingBlockSelection.lessonId !== lesson?.id) return;
    blocks.setSelectedBlockId(pendingBlockSelection.blockId);
    setPendingBlockSelection(null);
  }, [lesson?.id, pendingBlockSelection]);
  const create = (type) => newCourseBlock(type, content.language);
  const showPublication = () => document.getElementById('project-publication-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const selectIssue = (path) => {
    const moduleIndex = Number(/modules\[(\d+)\]/.exec(path)?.[1]);
    const sectionIndex = Number(/sections\[(\d+)\]/.exec(path)?.[1]);
    const lessonIndex = Number(/lessons\[(\d+)\]/.exec(path)?.[1]);
    const blockIndex = Number(/blocks\[(\d+)\]/.exec(path)?.[1]);
    const owner = content.modules[moduleIndex];
    if (!owner) { setSelected({ type: 'overview' }); return; }
    const sectionOwner = Number.isInteger(sectionIndex) ? owner.sections?.[sectionIndex] : null;
    const target = Number.isInteger(lessonIndex) ? (sectionOwner?.lessons ?? owner.lessons)?.[lessonIndex] : null;
    setSelected(target ? { type: 'lesson', moduleId: owner.id, lessonId: target.id } : sectionOwner ? { type: 'section', moduleId: owner.id, sectionId: sectionOwner.id } : { type: 'module', moduleId: owner.id });
    if (target && Number.isInteger(blockIndex)) setPendingBlockSelection({ lessonId: target.id, blockId: target.blocks[blockIndex]?.id ?? null });
    setView('author');
  };
  return <div className="project-studio course-studio studio-unified">
    <StudioHeader type="COURSE" title={content.title} draft={draft} dirty={dirty} saveError={saveError} readOnly={readOnly} role={role} view={view} onView={setView} onValidate={() => setValidation(validateCourseDraft(draft))} onHistory={repository.publish ? showPublication : null} onPublish={repository.publish ? () => document.getElementById('content-studio-publish-button')?.click() : null} onReload={reload} />
    {view === 'json' ? <section className="content-json-view"><pre><code>{json}</code></pre></section> : view === 'preview' ? <CoursePreview course={content} /> : <StudioWorkspace structureLabel="Course structure" toolbar={<BlockPalette variant="toolbar" definitions={content.language === 'none' ? coursePalette.filter((item) => item.type !== 'compiler') : coursePalette} create={create} dispatch={blocks.dispatch} disabled={readOnly || !lesson} selectedBlockId={blocks.selectedBlockId} />} structure={<CourseTree course={content} selected={selected} select={setSelected} addModule={addModule} addSection={addSection} addLesson={addLesson} update={update} readOnly={readOnly} />} canvas={lesson ? <><header className="studio-canvas-heading"><h2>{lesson.title}</h2><span>{lesson.blocks.length} blocks</span></header><BlockCanvas blocks={blocks.canvasBlocks} selectedBlockId={blocks.selectedBlockId} readOnly={readOnly} language={content.language} dispatch={blocks.dispatch} create={create} renderPreview={courseBlockSummary} /></> : <div className="content-studio-empty"><h2>{section?.title ?? module?.title ?? content.title}</h2><p>{selected.type === 'section' ? 'Choose a lesson or add one to this section.' : selected.type === 'module' ? 'Choose a lesson or section to author.' : 'Choose a module or lesson to begin authoring.'}</p></div>} inspector={<><h2 className="studio-inspector-heading">{blocks.selectedBlock && lesson ? 'Block properties' : selected.type === 'lesson' ? 'Lesson properties' : selected.type === 'section' ? 'Section properties' : selected.type === 'module' ? 'Module properties' : 'Course properties'}</h2>{blocks.selectedBlock && lesson ? <LegacyBlockInspector block={blocks.selectedBlock} readOnly={readOnly} onChange={(patch) => patchLesson({ blocks: lesson.blocks.map((item) => item.id === blocks.selectedBlockId ? { ...item, ...patch } : item) })} /> : selected.type === 'lesson' && lesson ? <CourseLessonMetadata lesson={lesson} patch={patchLesson} readOnly={readOnly} /> : selected.type === 'section' && section ? <div className="project-form"><SectionEditor section={section} patch={patchSection} readOnly={readOnly} /></div> : selected.type === 'module' && module ? <div className="project-form"><ModuleEditor module={module} patch={patchModule} readOnly={readOnly} /></div> : <div className="project-form"><CourseOverview course={content} patch={patchContent} readOnly={readOnly} /></div>}</>} />}
    {validation && <section className="project-validation" aria-live="polite"><h2>Course validation</h2>{validation.valid ? <p>Content is valid</p> : <><p>{validation.errors.length} issues to fix.</p><ul>{validation.errors.map((error, index) => <li key={`${error.path}-${index}`}><button type="button" onClick={() => selectIssue(error.path)}>{error.path}: {error.message}</button></li>)}</ul></>}</section>}
    {repository.publish ? <ProjectPublicationPanel draft={draft} dirty={dirty} role={role} repository={repository} onValidation={setValidation} onReload={reload} /> : null}
  </div>;
}

function courseBlockSummary(block) { return <p className="studio-block-summary">{String(block.text ?? block.content ?? block.code ?? block.title ?? '').slice(0, 220)}</p>; }

function CourseLessonMetadata({ lesson, patch, readOnly }) {
  return <div className="project-form"><section><h2>Lesson {lesson.order}</h2><div className="project-fields"><Field label="Stable lesson ID" value={lesson.id} readOnly /><Field label="Title" value={lesson.title} readOnly={readOnly} onChange={(event) => patch({ title: event.target.value })} /><label><span>Summary</span><textarea value={lesson.summary ?? ''} readOnly={readOnly} onChange={(event) => patch({ summary: event.target.value })} /></label><Field label="Estimated minutes" type="number" min="0" value={lesson.estimatedMinutes ?? 0} readOnly={readOnly} onChange={(event) => patch({ estimatedMinutes: Number(event.target.value) })} /></div></section></div>;
}

function CourseTree({ course, selected, select, addModule, addSection, addLesson, update, readOnly }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [collapsedModules, setCollapsedModules] = useState(() => new Set());
  const [collapsedSections, setCollapsedSections] = useState(() => new Set());
  const toggle = (setter, id) => setter((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const updateLessonGroup = (moduleId, sectionId, fn) => update((value) => {
    const owner = value.modules.find((item) => item.id === moduleId);
    const group = sectionId ? owner.sections.find((item) => item.id === sectionId) : owner;
    group.lessons = fn(group.lessons);
    return value;
  });
  const lessonRows = (module, section) => (section?.lessons ?? module.lessons).map((lesson, lessonIndex, group) => <div className={`course-outline-row course-outline-lesson ${section ? 'is-section-lesson' : ''}`} key={lesson.id}>
    <button type="button" className={`course-outline-label ${selected.lessonId === lesson.id && selected.type === 'lesson' ? 'active' : ''}`} aria-current={selected.lessonId === lesson.id && selected.type === 'lesson' ? 'page' : undefined} onClick={() => select({ type: 'lesson', moduleId: module.id, lessonId: lesson.id })}><BookOpen aria-hidden="true" /><span className="course-outline-title">{lesson.order}. {lesson.title}</span></button>
    {!readOnly && <CourseRowMenu menuId={`lesson:${lesson.id}`} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} title={lesson.title} actions={[
      { label: `Move ${lesson.title} up`, disabled: lessonIndex === 0, run: () => updateLessonGroup(module.id, section?.id, (items) => move(items, lessonIndex, -1)) },
      { label: `Move ${lesson.title} down`, disabled: lessonIndex === group.length - 1, run: () => updateLessonGroup(module.id, section?.id, (items) => move(items, lessonIndex, 1)) },
      { label: `Delete ${lesson.title}`, disabled: group.length === 1, run: () => {
        update((value) => {
          const owner = value.modules.find((item) => item.id === module.id);
          const target = section ? owner.sections.find((item) => item.id === section.id) : owner;
          target.lessons = reindexCourse(target.lessons.filter((item) => item.id !== lesson.id));
          if (value.defaultLessonId === lesson.id) value.defaultLessonId = value.modules.flatMap(courseLessons)[0]?.id;
          return value;
        });
        select({ type: section ? 'section' : 'module', moduleId: module.id, sectionId: section?.id });
      } },
    ]} />}
  </div>);
  return <nav className="project-tree course-outline" aria-label="Course structure">
    <button type="button" className={`course-outline-overview ${selected.type === 'overview' ? 'active' : ''}`} aria-current={selected.type === 'overview' ? 'page' : undefined} onClick={() => select({ type: 'overview' })}>Course Overview</button>
    {course.modules.map((module, moduleIndex) => <div className="course-outline-module" key={module.id}>
      <div className="course-outline-row course-outline-module-row">
        <button type="button" className="course-outline-toggle" aria-label={`${collapsedModules.has(module.id) ? 'Expand' : 'Collapse'} ${module.title}`} aria-expanded={!collapsedModules.has(module.id)} onClick={() => toggle(setCollapsedModules, module.id)}>{collapsedModules.has(module.id) ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</button>
        <button type="button" className={`course-outline-label ${selected.moduleId === module.id && selected.type === 'module' ? 'active' : ''}`} aria-current={selected.moduleId === module.id && selected.type === 'module' ? 'page' : undefined} onClick={() => select({ type: 'module', moduleId: module.id })}><strong className="course-outline-title">{module.order}. {module.title}</strong><span className="course-outline-count">{courseLessons(module).length} lessons</span></button>
        {!readOnly && <><button type="button" className="studio-tree-icon course-outline-add-icon" aria-label={module.sections ? `+ Add section to ${module.title}` : '+ Add lesson'} onClick={() => module.sections ? addSection(module.id) : addLesson(module.id)}><Plus aria-hidden="true" /></button><CourseRowMenu menuId={`module:${module.id}`} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} title={module.title} actions={[
          { label: `Move ${module.title} up`, disabled: moduleIndex === 0, run: () => update((value) => { value.modules = move(value.modules, moduleIndex, -1); return value; }) },
          { label: `Move ${module.title} down`, disabled: moduleIndex === course.modules.length - 1, run: () => update((value) => { value.modules = move(value.modules, moduleIndex, 1); return value; }) },
          { label: `Delete ${module.title}`, disabled: course.modules.length === 1, run: () => update((value) => { value.modules = reindexCourse(value.modules.filter((item) => item.id !== module.id)); if (!value.modules.flatMap(courseLessons).some((item) => item.id === value.defaultLessonId)) value.defaultLessonId = value.modules.flatMap(courseLessons)[0]?.id; select({ type: 'overview' }); return value; }) },
        ]} /></>}
      </div>
      {!collapsedModules.has(module.id) && <div className="course-outline-children">
        {module.sections ? module.sections.map((section, sectionIndex) => <div className="course-outline-section" key={section.id}>
          <div className="course-outline-row course-outline-section-row">
            <button type="button" className="course-outline-toggle" aria-label={`${collapsedSections.has(section.id) ? 'Expand' : 'Collapse'} ${section.title}`} aria-expanded={!collapsedSections.has(section.id)} onClick={() => toggle(setCollapsedSections, section.id)}>{collapsedSections.has(section.id) ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</button>
            <button type="button" className={`course-outline-label ${selected.sectionId === section.id && selected.type === 'section' ? 'active' : ''}`} aria-current={selected.sectionId === section.id && selected.type === 'section' ? 'page' : undefined} onClick={() => select({ type: 'section', moduleId: module.id, sectionId: section.id })}><span className="course-outline-title">{section.title}</span><span className="course-outline-count">{section.lessons.length} items</span></button>
            {!readOnly && <><button type="button" className="studio-tree-icon course-outline-add-icon" aria-label={`+ Add lesson to ${section.title}`} onClick={() => addLesson(module.id, section.id)}><Plus aria-hidden="true" /></button><CourseRowMenu menuId={`section:${section.id}`} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} title={section.title} actions={[
              { label: `Move ${section.title} up`, disabled: sectionIndex === 0, run: () => update((value) => { const owner = value.modules.find((item) => item.id === module.id); owner.sections = move(owner.sections, sectionIndex, -1); return value; }) },
              { label: `Move ${section.title} down`, disabled: sectionIndex === module.sections.length - 1, run: () => update((value) => { const owner = value.modules.find((item) => item.id === module.id); owner.sections = move(owner.sections, sectionIndex, 1); return value; }) },
              { label: `Delete ${section.title}`, disabled: module.sections.length === 1, run: () => update((value) => { const owner = value.modules.find((item) => item.id === module.id); owner.sections = reindexCourse(owner.sections.filter((item) => item.id !== section.id)); if (!value.modules.flatMap(courseLessons).some((item) => item.id === value.defaultLessonId)) value.defaultLessonId = value.modules.flatMap(courseLessons)[0]?.id; select({ type: 'module', moduleId: module.id }); return value; }) },
            ]} /></>}
          </div>
          {!collapsedSections.has(section.id) && <div className="course-outline-children">{lessonRows(module, section)}</div>}
        </div>) : lessonRows(module)}
        {!readOnly && <button type="button" className="course-outline-add-section" onClick={() => addSection(module.id)}>+ Add section</button>}
      </div>}
    </div>)}
    {!readOnly && <button type="button" className="course-outline-add-module" onClick={addModule}>+ Add module</button>}
  </nav>;
}

function CourseRowMenu({ menuId, openMenuId, setOpenMenuId, title, actions }) {
  const open = openMenuId === menuId;
  const menuDomId = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const gap = 4;
    const margin = 8;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const above = trigger.top - margin;
    const below = window.innerHeight - trigger.bottom - margin;
    const preferredTop = below < height + gap && above > below ? trigger.top - height - gap : trigger.bottom + gap;
    setPosition({
      top: Math.max(margin, Math.min(preferredTop, window.innerHeight - height - margin)),
      left: Math.max(margin, Math.min(trigger.right - width, window.innerWidth - width - margin)),
      ready: true,
    });
    menu.querySelector('button:not(:disabled)')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const structureScroller = triggerRef.current?.closest('.studio-structure-content');
    const closeOutside = (event) => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpenMenuId((current) => current === menuId ? null : current);
    };
    const closeOnScroll = () => setOpenMenuId((current) => current === menuId ? null : current);
    const closeOnKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpenMenuId((current) => current === menuId ? null : current);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    structureScroller?.addEventListener('scroll', closeOnScroll);
    document.addEventListener('keydown', closeOnKey, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      structureScroller?.removeEventListener('scroll', closeOnScroll);
      document.removeEventListener('keydown', closeOnKey, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [open, menuId, setOpenMenuId]);
  return <>
    <button ref={triggerRef} type="button" className="studio-tree-menu-trigger" aria-label={`Actions for ${title}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuDomId : undefined} onClick={() => setOpenMenuId((current) => current === menuId ? null : menuId)}><MoreVertical aria-hidden="true" /></button>
    {open ? createPortal(<div ref={menuRef} id={menuDomId} className="studio-tree-popover" role="menu" aria-label={`Actions for ${title}`} style={{ top: position.top, left: position.left, visibility: position.ready ? 'visible' : 'hidden' }} onKeyDown={(event) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
      event.preventDefault();
    }}>{actions.map((action) => <button key={action.label} type="button" role="menuitem" disabled={action.disabled} onClick={() => {
      setOpenMenuId((current) => current === menuId ? null : current);
      action.run();
      if (action.label.startsWith('Delete ')) requestAnimationFrame(() => document.querySelector('[aria-label="Course structure"] button.active')?.focus());
      else triggerRef.current?.focus();
    }}>{action.label}</button>)}</div>, document.body) : null}
  </>;
}

function CourseOverview({ course, patch, readOnly }) {
  return <section><h2>Course metadata</h2><div className="project-fields">
    <Field label="Stable Course ID" value={course.courseId} readOnly />
    <Field label="Title" value={course.title} readOnly={readOnly} onChange={(e) => patch({ title: e.target.value })} />
    <Field label="Subtitle" value={course.subtitle ?? ''} readOnly={readOnly} onChange={(e) => patch({ subtitle: e.target.value })} />
    <label><span>Description</span><textarea value={course.description} readOnly={readOnly} onChange={(e) => patch({ description: e.target.value })} /></label>
    <label><span>Language</span><select value={course.language} disabled={readOnly} onChange={(e) => patch({ language: e.target.value })}>{COURSE_LANGUAGE_IDS.map((language) => <option value={language} key={language}>{language === 'none' ? 'None (non-programming)' : language}</option>)}</select></label>
    <label><span>Difficulty</span><select value={course.difficulty} disabled={readOnly} onChange={(e) => patch({ difficulty: e.target.value })}>{['Beginner','Easy','Intermediate','Advanced'].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label className="course-coming-soon-field"><span>Coming Soon</span><input type="checkbox" checked={course.comingSoon === true} disabled={readOnly} onChange={(e) => patch({ comingSoon: e.target.checked })} /><small>Keeps the course unavailable for normal learner enrollment/discovery until you are ready to launch it.</small></label>
    <Field label="Estimated minutes" type="number" min="1" value={course.estimatedMinutes} readOnly={readOnly} onChange={(e) => patch({ estimatedMinutes: Number(e.target.value) })} />
    <Field label="Derived module count" value={course.modules.length} readOnly />
    <Field label="Derived lesson count" value={countCourseLessons(course)} readOnly />
    <Lines label="Prerequisites" value={course.prerequisites} readOnly={readOnly} onChange={(value) => patch({ prerequisites: value })} />
    <Lines label="Learning outcomes" value={course.learningOutcomes} readOnly={readOnly} onChange={(value) => patch({ learningOutcomes: value })} />
  </div></section>;
}
function ModuleEditor({ module, patch, readOnly }) { return <section><h2>Module {module.order}</h2><div className="project-fields"><Field label="Stable module ID" value={module.id} readOnly /><Field label="Title" value={module.title} readOnly={readOnly} onChange={(e) => patch({ title: e.target.value })} /><label><span>Description</span><textarea value={module.description ?? ''} readOnly={readOnly} onChange={(e) => patch({ description: e.target.value })} /></label></div></section>; }
function SectionEditor({ section, patch, readOnly }) { return <section><h2>Section {section.order}</h2><div className="project-fields"><Field label="Stable section ID" value={section.id} readOnly /><Field label="Title" value={section.title} readOnly={readOnly} onChange={(e) => patch({ title: e.target.value })} /><label><span>Description</span><textarea value={section.description ?? ''} readOnly={readOnly} onChange={(e) => patch({ description: e.target.value })} /></label></div></section>; }

function CoreLessonEditor({ lesson, patch, language, readOnly }) {
  const updateBlock = (id, delta) => patch({ blocks: lesson.blocks.map((block) => block.id === id ? { ...block, ...delta } : block) });
  const addBlock = (type) => { const block = type === 'quiz' ? { id: courseUid('quiz'), type, question: 'Choose the correct answer.', selectionMode: 'single', options: [{ id: 'option-a', text: 'Answer A' }, { id: 'option-b', text: 'Answer B' }], correctOptionIds: ['option-a'], submitLabel: 'Check answer' } : type === 'compiler' ? { id: courseUid('compiler'), type, language, runtime: language, starterCode: '', expectedOutput: '', runLabel: 'Run code', resetLabel: 'Reset' } : type === 'code' ? { id: courseUid('code'), type, language: language === 'none' ? 'text' : language, code: '', mode: 'display' } : type === 'heading' ? { id: courseUid('heading'), type, text: '' } : { id: courseUid(type), type, content: '', format: 'plain' }; patch({ blocks: [...lesson.blocks, block] }); };
  return <section><h2>Lesson {lesson.order}</h2><div className="project-fields"><Field label="Stable lesson ID" value={lesson.id} readOnly /><Field label="Title" value={lesson.title} readOnly={readOnly} onChange={(e) => patch({ title: e.target.value })} /><label><span>Summary</span><textarea value={lesson.summary ?? ''} readOnly={readOnly} onChange={(e) => patch({ summary: e.target.value })} /></label><Field label="Estimated minutes" type="number" min="0" value={lesson.estimatedMinutes ?? 0} readOnly={readOnly} onChange={(e) => patch({ estimatedMinutes: Number(e.target.value) })} /></div><h3>Lesson blocks</h3>{lesson.blocks.map((block) => <article className="project-card" key={block.id}><strong>{block.type}</strong><Field label="Stable block ID" value={block.id} readOnly />{block.type === 'quiz' ? <><Field label="Question" value={block.question} readOnly={readOnly} onChange={(e) => updateBlock(block.id, { question: e.target.value })} /><Field label="Options (one per line; first is correct)" value={block.options.map((option) => option.text).join('\n')} readOnly={readOnly} onChange={(e) => { const options = e.target.value.split('\n').filter(Boolean).map((text, i) => ({ id: `option-${i + 1}`, text })); updateBlock(block.id, { options, correctOptionIds: options[0] ? [options[0].id] : [] }); }} /></> : ['code','compiler'].includes(block.type) ? <><label><span>{block.type === 'compiler' ? 'Starter code' : 'Code'}</span><textarea value={block.starterCode ?? block.code ?? ''} readOnly={readOnly} onChange={(e) => updateBlock(block.id, block.type === 'compiler' ? { starterCode: e.target.value } : { code: e.target.value })} /></label>{block.type === 'compiler' && <Field label="Expected output" value={block.expectedOutput ?? ''} readOnly={readOnly} onChange={(e) => updateBlock(block.id, { expectedOutput: e.target.value })} />}</> : <label><span>Content</span><textarea value={block.content ?? block.text ?? ''} readOnly={readOnly} onChange={(e) => updateBlock(block.id, Object.hasOwn(block, 'text') ? { text: e.target.value } : { content: e.target.value })} /></label>}{!readOnly && <button onClick={() => patch({ blocks: lesson.blocks.filter((item) => item.id !== block.id) })}><Trash2 /> Delete block</button>}</article>)}{!readOnly && <div className="project-toolbar">{['paragraph','heading','code','quiz','compiler'].map((type) => <button key={type} onClick={() => addBlock(type)}>+ {type}</button>)}</div>}</section>;
}

const legacyBlockTypes = ['callout', 'note', 'warning', 'image', 'table', 'exercise', 'solution', 'expected-output', 'list'];

function newCourseBlock(type, language) {
  if (type === 'quiz') return { id: courseUid('quiz'), type, question: 'Choose the correct answer.', selectionMode: 'single', options: [{ id: 'option-a', text: 'Answer A' }, { id: 'option-b', text: 'Answer B' }], correctOptionIds: ['option-a'], submitLabel: 'Check answer' };
  if (type === 'compiler') return { id: courseUid('compiler'), type, language, runtime: language, starterCode: '', expectedOutput: '', runLabel: 'Run code', resetLabel: 'Reset' };
  if (type === 'code') return { id: courseUid('code'), type, language: language === 'none' ? 'text' : language, code: '', mode: 'display' };
  if (type === 'heading') return { id: courseUid('heading'), type, text: 'New heading' };
  return makeLegacyBlock(type, language);
}

function makeLegacyBlock(type, language) {
  const base = { id: courseUid(type), type };
  if (type === 'image') return { ...base, assetId: '', alt: '' };
  if (type === 'table') return { ...base, columns: [{ key: 'column-1', header: 'Column 1' }], rows: [{ 'column-1': '' }] };
  if (type === 'exercise') return { ...base, title: '', instructions: { content: '', format: 'plain' }, objectives: [], hints: [], starterFiles: [{ name: language === 'python' ? 'main.py' : 'main.txt', content: '' }] };
  if (type === 'solution') return { ...base, title: 'View solution', description: '', language: language === 'none' ? 'text' : language, code: '' };
  if (type === 'expected-output') return { ...base, content: '' };
  if (type === 'list') return { ...base, items: [''] };
  return { ...base, title: '', content: '', format: 'plain' };
}

function LessonEditor({ lesson, patch, language, readOnly }) {
  const updateBlock = (id, delta) => patch({ blocks: lesson.blocks.map((block) => block.id === id ? { ...block, ...delta } : block) });
  const addBlock = (type) => patch({ blocks: [...lesson.blocks, makeLegacyBlock(type, language)] });
  return <>
    <CoreLessonEditor lesson={lesson} patch={patch} language={language} readOnly={readOnly} />
    <section aria-label="Additional Course block fields">
      <h3>Legacy and media blocks</h3>
      {lesson.blocks.filter((block) => legacyBlockTypes.includes(block.type)).map((block) => <article className="project-card" key={block.id}>
        <h4>{block.type} fields</h4>
        {['callout', 'note', 'warning'].includes(block.type) && <><Field label={`${block.id} title`} value={block.title ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { title: event.target.value })} /><label><span>{block.id} body</span><textarea value={block.content ?? block.text ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { content: event.target.value })} /></label></>}
        {block.type === 'image' && <><Field label={`${block.id} asset ID`} value={block.assetId ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { assetId: event.target.value })} />{!readOnly && <AssetPicker onSelect={(assetId) => updateBlock(block.id, { assetId, src: undefined })} />}<Field label={`${block.id} legacy asset path`} value={block.src ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { src: event.target.value })} /><Field label={`${block.id} alt text`} value={block.alt ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { alt: event.target.value })} /><Field label={`${block.id} caption`} value={block.caption ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { caption: event.target.value })} /></>}
        {block.type === 'table' && <><Lines label={`${block.id} column headers`} value={(block.columns ?? []).map((column) => column.header)} readOnly={readOnly} onChange={(headers) => updateBlock(block.id, { columns: headers.map((header, index) => ({ ...(block.columns?.[index] ?? {}), key: block.columns?.[index]?.key ?? `column-${index + 1}`, header })) })} /><label><span>{block.id} rows (pipe-separated)</span><textarea value={(block.rows ?? []).map((row) => (block.columns ?? []).map((column) => row[column.key] ?? '').join(' | ')).join('\n')} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { rows: event.target.value.split('\n').map((line) => Object.fromEntries((block.columns ?? []).map((column, index) => [column.key, line.split('|')[index]?.trim() ?? '']))) })} /></label></>}
        {block.type === 'list' && <Lines label={`${block.id} list items`} value={block.items ?? []} readOnly={readOnly} onChange={(items) => updateBlock(block.id, { items })} />}
        {block.type === 'exercise' && <><Field label={`${block.id} exercise title`} value={block.title ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { title: event.target.value })} /><label><span>{block.id} instructions</span><textarea value={typeof block.instructions === 'string' ? block.instructions : block.instructions?.content ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { instructions: { content: event.target.value, format: block.instructions?.format ?? 'plain' } })} /></label><Lines label={`${block.id} objectives`} value={block.objectives ?? []} readOnly={readOnly} onChange={(items) => updateBlock(block.id, { objectives: items })} /><Lines label={`${block.id} hints`} value={block.hints ?? []} readOnly={readOnly} onChange={(items) => updateBlock(block.id, { hints: items })} />{(block.starterFiles ?? []).map((file, index) => <div key={`${block.id}-file-${index}`}><Field label={`${block.id} starter filename ${index + 1}`} value={file.name} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { starterFiles: block.starterFiles.map((item, fileIndex) => fileIndex === index ? { ...item, name: event.target.value } : item) })} /><label><span>{block.id} starter file {index + 1}</span><textarea value={file.content} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { starterFiles: block.starterFiles.map((item, fileIndex) => fileIndex === index ? { ...item, content: event.target.value } : item) })} /></label></div>)}{!readOnly && <button type="button" onClick={() => updateBlock(block.id, { starterFiles: [...(block.starterFiles ?? []), { name: 'new-file.txt', content: '' }] })}>+ Add starter file</button>}</>}
        {block.type === 'solution' && <><Field label={`${block.id} solution title`} value={block.title ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { title: event.target.value })} /><label><span>{block.id} explanation</span><textarea value={block.description ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { description: event.target.value })} /></label><label><span>{block.id} solution code</span><textarea value={block.code ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { code: event.target.value })} /></label></>}
        {block.type === 'expected-output' && <label><span>{block.id} expected output</span><textarea value={block.content ?? block.text ?? ''} readOnly={readOnly} onChange={(event) => updateBlock(block.id, { content: event.target.value })} /></label>}
      </article>)}
      {!readOnly && <div className="project-toolbar">{legacyBlockTypes.map((type) => <button key={type} type="button" onClick={() => addBlock(type)}>+ {type}</button>)}</div>}
    </section>
  </>;
}

export function CoursePreview({ course }) {
  const [lessonId, setLessonId] = useState(course.defaultLessonId ?? courseLessons(course.modules[0])[0]?.id);
  const lessons = course.modules.flatMap(courseLessons); const lesson = lessons.find((item) => item.id === lessonId) ?? lessons[0];
  const lessonIndex = lessons.findIndex((item) => item.id === lesson?.id);
  return <section className="project-preview"><header><div><h2>{course.title}</h2><p>{course.description}</p><p>{course.modules.length} modules · {lessons.length} lessons</p></div><label><span>Lesson</span><select value={lesson?.id} onChange={(e) => setLessonId(e.target.value)}>{lessons.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label></header>
    <nav aria-label="Preview modules">{course.modules.map((module) => <div key={module.id}><strong>{module.title}</strong>{courseLessons(module).map((item) => <button key={item.id} type="button" aria-current={item.id === lesson?.id ? 'page' : undefined} onClick={() => setLessonId(item.id)}>{item.title}</button>)}</div>)}</nav>
    <article className="project-preview-guide"><h2>{lesson?.title}</h2>{lesson?.blocks.map((block) => <CoursePreviewBlock block={block} key={block.id} />)}</article>
    <div className="project-toolbar"><button type="button" disabled={lessonIndex <= 0} onClick={() => setLessonId(lessons[lessonIndex - 1].id)}>Previous lesson</button><button type="button" disabled={lessonIndex >= lessons.length - 1} onClick={() => setLessonId(lessons[lessonIndex + 1].id)}>Next lesson</button></div>
    <p>No learner progress is persisted from Admin Preview.</p></section>;
}

function CoursePreviewBlock({ block }) {
  const [selected, setSelected] = useState([]);
  const [checked, setChecked] = useState(false);
  if (block.type === 'heading') return <h3>{block.text}</h3>;
  if (block.type === 'quiz') {
    const correct = selected.length === block.correctOptionIds.length && selected.every((id) => block.correctOptionIds.includes(id));
    return <fieldset><legend>{block.question}</legend>{block.options.map((option) => <label key={option.id}><input type={block.selectionMode === 'multiple' ? 'checkbox' : 'radio'} name={block.id} checked={selected.includes(option.id)} onChange={() => { setSelected((current) => block.selectionMode === 'multiple' ? current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id] : [option.id]); setChecked(false); }} /> {option.text}</label>)}<button type="button" disabled={!selected.length} onClick={() => setChecked(true)}>{block.submitLabel ?? 'Check answer'}</button>{checked && <p role="status">{correct ? 'Correct answer.' : 'Try again.'}</p>}</fieldset>;
  }
  if (block.type === 'image') return <figure>{block.assetId?.startsWith('asset-') && !block.src ? <AssetPreview asset={{ assetId: block.assetId }} alt={block.alt ?? ''} /> : block.src ? <img src={block.src} alt={block.alt ?? ''} /> : <span role="alert">Image asset unavailable</span>}{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
  if (block.type === 'table') return <table><thead><tr>{(block.columns ?? []).map((column) => <th key={column.key}>{column.header}</th>)}</tr></thead><tbody>{(block.rows ?? []).map((row, index) => <tr key={index}>{(block.columns ?? []).map((column) => <td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody></table>;
  if (block.type === 'list') return <ul>{(block.items ?? []).map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.text ?? ''}</li>)}</ul>;
  if (block.type === 'exercise') return <section><h3>{block.title}</h3><p>{typeof block.instructions === 'string' ? block.instructions : block.instructions?.content}</p>{block.starterFiles?.map((file) => <pre key={file.name}><code>{file.name}{'\n'}{file.content}</code></pre>)}</section>;
  if (block.type === 'divider') return <hr />;
  if (['code', 'compiler', 'solution', 'expected-output'].includes(block.type)) return <div><pre><code>{block.starterCode ?? block.code ?? block.content ?? block.expectedOutput}</code></pre>{block.type === 'compiler' && <><p>Language: {block.language}; runtime: {block.runtime}</p>{block.stdin && <p>Standard input: {block.stdin}</p>}{block.expectedOutput != null && <p>Expected output: {block.expectedOutput}</p>}<p>Compiler exercise: run and verification are available in the learner workspace after publication.</p></>}</div>;
  return <div>{block.title && <h3>{block.title}</h3>}<p>{block.content ?? block.text}</p></div>;
}
