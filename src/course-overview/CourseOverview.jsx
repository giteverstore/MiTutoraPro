import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  FileCheck2,
  FlaskConical,
  Layers3,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { createCourseOverviewModel } from '../course/createCourseOverviewModel';
import { DifficultyBadge, courseDifficultyBadge } from '../components/DifficultyBadge';
import { useHeroPointerGrid } from '../components/useHeroPointerGrid';
import { ICON_SIZE } from '../design-system/theme';
import { useOptionalLearningProgress } from '../progress/LearningProgressContext';
import { trustedCompletionDevelopmentService } from '../progress/TrustedCompletionDevelopmentService';
import { getCourseOverviewPresentation } from './courseOverviewPresentation';
import '../styles/hero-pointer-grid.css';
import '../styles/pages/dashboard.css';

const anonymousProgress = Object.freeze({ courseProgress: 0, completedLessons: [], completedLessonCount: 0, sequentialCompletedLessons: 0, visitedLessonCount: 0 });

export function CourseOverview({ course, onEnterCourse, onResetCourse, onStartExam, anonymous = false }) {
  const { heroRef, onPointerEnter, onPointerMove, onPointerLeave } = useHeroPointerGrid();
  const storedProgress = useOptionalLearningProgress();
  const progress = storedProgress ?? anonymousProgress;
  const model = useMemo(
    () => createCourseOverviewModel(course, progress),
    [course, progress],
  );
  const isCompleted = model.lessonCount > 0
    && progress.sequentialCompletedLessons === model.lessonCount;
  const isStarted = progress.visitedLessonCount > 0 || progress.completedLessonCount > 0;
  const presentation = getCourseOverviewPresentation(model.id);
  const difficultyBadge = courseDifficultyBadge(model.difficulty);
  const category = course.language && course.language !== 'none'
    ? course.language
    : course.metadata?.tags?.[0];
  const courseLabel = category
    ? `${String(category).trim().length <= 3 ? String(category).toUpperCase() : String(category).replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())} Course`
    : 'Course';
  const progressPending = !anonymous && storedProgress?.status === 'loading';
  const actionLabel = isCompleted
    ? 'Review Course'
    : isStarted
      ? 'Continue Learning'
      : presentation?.startLabel ?? 'Start Course';

  useEffect(() => {
    document.title = `${model.title} · ycoders`;
  }, [model.title]);

  return (
    <div className="course-overview-shell">
      <section className="overview-hero overview-hero--full-bleed hero-pointer-grid-host" ref={heroRef} onPointerEnter={onPointerEnter} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
          <div className="overview-hero-grid hero-pointer-grid" aria-hidden="true" />
          <div className="overview-hero-grid-highlight hero-pointer-grid-highlight" aria-hidden="true" />
          <div className="overview-hero-layout">
            <div className="overview-hero-copy">
              <div className="overview-hero-kicker"><span>{courseLabel}</span>{difficultyBadge ? <DifficultyBadge difficulty={difficultyBadge} /> : null}</div>
              <h1>{model.title}</h1>
              <p>{model.description}</p>
              {model.certificateAvailable ? <span className="overview-certification-badge"><Award size={ICON_SIZE.sm} aria-hidden="true" /> Certification Available</span> : null}
            </div>
            <aside className="overview-hero-summary" aria-label="Course summary">
              <div className="overview-hero-metrics">
                <div><Layers3 size={ICON_SIZE.base} aria-hidden="true" /><strong>{model.moduleCount}</strong><span>Modules</span></div>
                <div><Code2 size={ICON_SIZE.base} aria-hidden="true" /><strong>{model.quizCount + model.exerciseCount}</strong><span>Problems</span></div>
                <div><Clock3 size={ICON_SIZE.base} aria-hidden="true" /><strong>{model.estimatedDuration}</strong><span>Duration</span></div>
              </div>
              <div className={`overview-hero-summary-bottom${isCompleted && onStartExam ? ' has-exam-action' : ''}`}>
                {progressPending ? <div className="overview-hero-progress-pending" role="status">Loading progress…</div> : <div className="overview-hero-progress">
                  <div className="overview-hero-progress-label"><span>{progress.completedLessonCount}/{model.lessonCount} lessons</span><strong>{progress.courseProgress}% done</strong></div>
                  <div role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.courseProgress}>
                    <span style={{ width: `${progress.courseProgress}%` }} />
                  </div>
                </div>}
                <div className="overview-hero-actions">
                  <button className="button button--primary overview-primary-action" type="button" onClick={onEnterCourse}>
                    {actionLabel} <ArrowRight size={ICON_SIZE.base} aria-hidden="true" />
                  </button>
                  {isCompleted && onStartExam ? (
                    <button className="button button--secondary overview-primary-action" type="button" onClick={onStartExam}>
                      <FileCheck2 size={ICON_SIZE.base} aria-hidden="true" /> Take Online Exam <ArrowRight size={ICON_SIZE.base} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
      </section>

      <main className="course-overview-main">
        <section className="overview-details-grid">
          <DetailCard title="Skills you’ll learn" icon={Sparkles} items={model.skills} />
          <DetailCard title="Prerequisites" icon={CheckCircle2} items={model.prerequisites} />
        </section>

        <ModuleList modules={model.modules} />

        {import.meta.env.DEV && !anonymous && storedProgress ? (
          <DevelopmentControls course={course} progress={progress} onResetCourse={onResetCourse} />
        ) : null}

      </main>
    </div>
  );
}

function DetailCard({ title, icon: Icon, items }) {
  return (
    <article className="overview-detail-card">
      <h2><Icon size={ICON_SIZE.lg} aria-hidden="true" /> {title}</h2>
      <ul>
        {items.map((item) => <li key={item}><Check size={ICON_SIZE.sm} aria-hidden="true" /> {item}</li>)}
      </ul>
    </article>
  );
}

function ModuleList({ modules }) {
  return (
    <section className="overview-modules">
      <div className="overview-section-heading">
        <div><span className="section-kicker">Curriculum</span><h2>What you’ll learn</h2></div>
        <span>{modules.length} {modules.length === 1 ? 'module' : 'modules'}</span>
      </div>
      <div className="overview-module-list">
        {modules.map((module, index) => (
          <details className="overview-module" key={module.id}>
            <summary>
              <span className="overview-module-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="overview-module-copy">
                <strong>{module.title}</strong>
                <small>{module.description}</small>
              </span>
              <span className="overview-module-progress">{module.completedCount}/{module.lessonCount}</span>
              <ChevronDown className="overview-module-chevron" size={ICON_SIZE.md} aria-hidden="true" />
            </summary>
            {module.sections.length ? module.sections.map((section) => (
              <details className="overview-curriculum-section" key={section.id}>
                <summary>
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.completedCount}/{section.lessonCount} lessons</small>
                  </span>
                  <ChevronDown className="overview-section-chevron" size={ICON_SIZE.sm} aria-hidden="true" />
                </summary>
                <ul>
                  {section.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <span className={lesson.completed ? 'is-completed' : ''}>
                        {lesson.completed ? <Check size={ICON_SIZE.xs} /> : lesson.number}
                      </span>
                      {lesson.title}
                    </li>
                  ))}
                </ul>
              </details>
            )) : <ul>
              {module.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <span className={lesson.completed ? 'is-completed' : ''}>
                    {lesson.completed ? <Check size={ICON_SIZE.xs} /> : lesson.number}
                  </span>
                  {lesson.title}
                </li>
              ))}
            </ul>}
          </details>
        ))}
      </div>
    </section>
  );
}

function DevelopmentControls({ course, progress, onResetCourse }) {
  const [trustedState, setTrustedState] = useState({ status: 'idle', message: '' });
  const recordTrustedCompletion = async () => {
    if (trustedState.status === 'recording') return;
    setTrustedState({ status: 'recording', message: 'Preparing trusted completionâ€¦' });
    try {
      const result = await trustedCompletionDevelopmentService.completeCourse(
        course,
        ({ completed, total }) => setTrustedState({
          status: 'recording',
          message: `Recording trusted completion: ${completed} / ${total}`,
        }),
      );
      progress.markAllLessonsComplete();
      const elapsedSeconds = (result.durationMs / 1000).toFixed(1);
      setTrustedState({
        status: 'success',
        message: `Trusted completion recorded in ${elapsedSeconds}s. Certification status: ${result.certification.eligibilityStatus}.`,
      });
    } catch (error) {
      setTrustedState({ status: 'error', message: error.message });
    }
  };

  const actions = [
    {
      label: 'Reset Course',
      action: () => {
        progress.resetCourse();
        onResetCourse();
      },
      danger: true,
    },
    { label: 'Mark All Lessons Complete', action: progress.markAllLessonsComplete },
    { label: 'Mark Course Trusted-Complete', action: recordTrustedCompletion },
    { label: 'Reset Progress', action: progress.resetLearningProgress },
    { label: 'Reset Quiz Attempts', action: progress.resetQuizAttempts },
    { label: 'Reset Exercise Attempts', action: progress.resetExerciseAttempts },
  ];

  return (
    <section className="overview-development">
      <div>
        <span className="section-kicker">Development only</span>
        <h2><FlaskConical size={ICON_SIZE.lg} /> Course state controls</h2>
        <p>These local controls are excluded from production builds.</p>
      </div>
      <div className="overview-development-actions">
        {actions.map(({ label, action, danger }) => (
          <button
            className={`button button--secondary${danger ? ' overview-danger-button' : ''}`}
            type="button"
            onClick={action}
            disabled={trustedState.status === 'recording'}
            key={label}
          >
            <RotateCcw size={ICON_SIZE.sm} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      {trustedState.message ? (
        <p className={`overview-development-status is-${trustedState.status}`} role={trustedState.status === 'error' ? 'alert' : 'status'}>
          {trustedState.message}
        </p>
      ) : null}
    </section>
  );
}
