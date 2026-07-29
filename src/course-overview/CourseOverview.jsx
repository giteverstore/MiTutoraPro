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
  FlaskConical,
  Layers3,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
} from 'lucide-react';
import { createCourseOverviewModel } from '../course/createCourseOverviewModel';
import { ICON_SIZE } from '../design-system/theme';
import { useLearningProgress } from '../progress/LearningProgressContext';

const STAT_DEFINITIONS = [
  { key: 'estimatedDuration', label: 'Estimated duration', icon: Clock3 },
  { key: 'moduleCount', label: 'Modules', icon: Layers3 },
  { key: 'lessonCount', label: 'Lessons', icon: BookOpen },
  { key: 'quizCount', label: 'Quizzes', icon: CheckCircle2 },
  { key: 'exerciseCount', label: 'Exercises', icon: Code2 },
  { key: 'certificate', label: 'Certificate', icon: Award },
];

export function CourseOverview({ course, onBack, onEnterCourse, onResetCourse }) {
  const progress = useLearningProgress();
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem('mi-tutora:theme') ?? 'light',
  );
  const model = useMemo(
    () => createCourseOverviewModel(course, progress),
    [course, progress],
  );
  const isCompleted = model.lessonCount > 0
    && progress.sequentialCompletedLessons === model.lessonCount;
  const isStarted = progress.visitedLessonCount > 0 || progress.completedLessonCount > 0;
  const actionLabel = isCompleted
    ? 'Review Course'
    : isStarted
      ? 'Continue Learning'
      : 'Start Course';

  useEffect(() => {
    document.title = `${model.title} · MiTutora`;
  }, [model.title]);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('mi-tutora:theme', next);
      return next;
    });
  };

  const stats = STAT_DEFINITIONS.map((stat) => ({
    ...stat,
    value: stat.key === 'certificate'
      ? model.certificateAvailable ? 'Available' : 'Not available'
      : model[stat.key],
  }));

  return (
    <div className="course-overview-shell" data-theme={theme}>
      <header className="course-overview-topbar">
        <button className="overview-back" type="button" onClick={onBack}>
          <ArrowLeft size={ICON_SIZE.base} aria-hidden="true" />
          Dashboard
        </button>
        <span className="overview-brand"><span>Mi</span> MiTutora</span>
        <button
          className="icon-button"
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
        >
          {theme === 'dark'
            ? <Sun size={ICON_SIZE.md} aria-hidden="true" />
            : <Moon size={ICON_SIZE.md} aria-hidden="true" />}
        </button>
      </header>

      <main className="course-overview-main">
        <section className="overview-hero">
          <div className="overview-hero-copy">
            <span className="overview-kicker"><Sparkles size={ICON_SIZE.sm} /> Course overview</span>
            <span className="overview-level">{model.difficulty}</span>
            <h1>{model.title}</h1>
            <p>{model.description}</p>
            <button className="button button--primary overview-primary-action" type="button" onClick={onEnterCourse}>
              {actionLabel} <ArrowRight size={ICON_SIZE.base} aria-hidden="true" />
            </button>
          </div>
          <ProgressSummary model={model} progress={progress} />
        </section>

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

        {import.meta.env.DEV ? (
          <DevelopmentControls progress={progress} onResetCourse={onResetCourse} />
        ) : null}

        <section className="overview-bottom-cta">
          <div>
            <span className="section-kicker">Ready when you are</span>
            <h2>{isCompleted ? 'Revisit the course at your own pace.' : 'Continue building your learning momentum.'}</h2>
          </div>
          <button className="button button--primary" type="button" onClick={onEnterCourse}>
            {actionLabel} <ArrowRight size={ICON_SIZE.base} aria-hidden="true" />
          </button>
        </section>
      </main>
    </div>
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
        <span>{modules.length} modules</span>
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
            <ul>
              {module.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <span className={lesson.completed ? 'is-completed' : ''}>
                    {lesson.completed ? <Check size={ICON_SIZE.xs} /> : lesson.number}
                  </span>
                  {lesson.title}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

function DevelopmentControls({ progress, onResetCourse }) {
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
            key={label}
          >
            <RotateCcw size={ICON_SIZE.sm} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
    </section>
  );
}
