import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
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
import { ICON_SIZE } from '../design-system/theme';
import { useOptionalLearningProgress } from '../progress/LearningProgressContext';
import { trustedCompletionDevelopmentService } from '../progress/TrustedCompletionDevelopmentService';
import { getCourseOverviewPresentation } from './courseOverviewPresentation';

const STAT_DEFINITIONS = [
  { key: 'estimatedDuration', label: 'Estimated duration', icon: Clock3 },
  { key: 'moduleCount', label: 'Modules', icon: Layers3 },
  { key: 'lessonCount', label: 'Lessons', icon: BookOpen },
  { key: 'quizCount', label: 'Quizzes', icon: CheckCircle2 },
  { key: 'exerciseCount', label: 'Exercises', icon: Code2 },
  { key: 'certificate', label: 'Certificate', icon: Award },
];

const anonymousProgress = Object.freeze({ courseProgress: 0, completedLessons: [], completedLessonCount: 0, sequentialCompletedLessons: 0, visitedLessonCount: 0 });

export function CourseOverview({ course, onBack, onEnterCourse, onResetCourse, onStartExam, anonymous = false }) {
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
  const actionLabel = isCompleted
    ? 'Review Course'
    : isStarted
      ? 'Continue Learning'
      : presentation?.startLabel ?? 'Start Course';

  useEffect(() => {
    document.title = `${model.title} · ycoders`;
  }, [model.title]);

  const stats = STAT_DEFINITIONS.map((stat) => ({
    ...stat,
    value: stat.key === 'certificate'
      ? model.certificateAvailable ? 'Available' : 'Not available'
      : model[stat.key],
  }));

  return (
    <div className="course-overview-shell">
      <main className="course-overview-main">
        <button className="overview-back" type="button" onClick={onBack}>
          <ArrowLeft size={ICON_SIZE.base} aria-hidden="true" />
          Dashboard
        </button>
        {presentation ? (
          <CourseArtworkHero
            model={model}
            progress={progress}
            presentation={presentation}
            actionLabel={actionLabel}
            onEnterCourse={onEnterCourse}
            onStartExam={isCompleted ? onStartExam : undefined}
            showProgress={!anonymous}
          />
        ) : (
          <section className="overview-hero">
            <div className="overview-hero-copy">
              <span className="overview-kicker"><Sparkles size={ICON_SIZE.sm} /> Course overview</span>
              <span className="overview-level">{model.difficulty}</span>
              <h1>{model.title}</h1>
              <p>{model.description}</p>
              <button className="button button--primary overview-primary-action" type="button" onClick={onEnterCourse}>
                {actionLabel} <ArrowRight size={ICON_SIZE.base} aria-hidden="true" />
              </button>
              {isCompleted && onStartExam ? (
                <button className="button button--secondary overview-primary-action" type="button" onClick={onStartExam}>
                  <FileCheck2 size={ICON_SIZE.base} aria-hidden="true" /> Take Online Exam <ArrowRight size={ICON_SIZE.base} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {anonymous ? null : <ProgressSummary model={model} progress={progress} />}
          </section>
        )}

        <section className="overview-stat-grid" aria-label="Course details">
          {stats.map(({ key, label, value, icon: Icon }) => (
            <article className="overview-stat-card" key={key}>
              <Icon size={ICON_SIZE.lg} aria-hidden="true" />
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

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

function CourseArtworkHero({ model, progress, presentation, actionLabel, onEnterCourse, onStartExam, showProgress = true }) {
  const heroStyle = { '--course-hero-artwork': `url("${presentation.artwork}")` };

  return (
    <section className="overview-hero overview-hero--artwork" style={heroStyle}>
      <div className="overview-hero-artwork-space" aria-hidden="true" />
      <div className="overview-hero-copy overview-hero-copy--artwork">
        <span className="overview-artwork-eyebrow">{presentation.eyebrow}</span>
        <h1>{presentation.heading}</h1>
        <p>{presentation.description}</p>
        <div className="overview-hero-actions">
          <button className="button overview-artwork-action" type="button" onClick={onEnterCourse}>
            {actionLabel} <ArrowRight size={ICON_SIZE.base} aria-hidden="true" />
          </button>
          {onStartExam ? (
            <button className="button overview-artwork-exam-action" type="button" onClick={onStartExam}>
              <FileCheck2 size={ICON_SIZE.base} aria-hidden="true" /> Take Online Exam <ArrowRight size={ICON_SIZE.base} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {showProgress && progress.courseProgress > 0 ? (
          <div className="overview-artwork-progress">
            <span><strong>{progress.courseProgress}%</strong> complete</span>
            <div role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress.courseProgress}>
              <span style={{ width: `${progress.courseProgress}%` }} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProgressSummary({ model, progress }) {
  return (
    <aside className="overview-progress-card" aria-label="Course progress">
      <div className="overview-progress-heading">
        <span>Your progress</span>
        <strong>{progress.courseProgress}%</strong>
      </div>
      <div
        className="overview-progress-track"
        role="progressbar"
        aria-label="Sequential course progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progress.courseProgress}
      >
        <span style={{ width: `${progress.courseProgress}%` }} />
      </div>
      <div className="overview-progress-metrics">
        <div><strong>{progress.completedLessonCount}</strong><span>Completed lessons</span></div>
        <div><strong>{progress.sequentialCompletedLessons}</strong><span>Sequential progress</span></div>
        <div><strong>{model.lessonCount}</strong><span>Total lessons</span></div>
      </div>
    </aside>
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
