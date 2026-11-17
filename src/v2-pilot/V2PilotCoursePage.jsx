import { useMemo, useState } from 'react';
import { CourseRoute } from '../routing/CourseRoute';
import { createV2CourseIdentity } from './contentIdentity';
import { createV2CourseLoaderRepository } from './createV2CourseLoaderRepository';
import { isV2CoursePilotEnabled } from './featureGate';
import { v2CourseRepository } from './V2CourseRepository';
import { disabledV2TrustedCompletionService } from './v2ProgressRepository';
import './v2-pilot.css';

export function V2PilotCoursePage({ contentId, publicationVersion, lessonId = null, shadow = false, onExit, onLessonRoute }) {
  const enabled = isV2CoursePilotEnabled();
  const [stage, setStage] = useState(lessonId ? 'learning' : 'overview');
  const identity = useMemo(() => createV2CourseIdentity({ contentId, publicationVersion }), [contentId, publicationVersion]);
  const bridge = useMemo(() => createV2CourseLoaderRepository({ identity, repository: v2CourseRepository, shadow }), [identity, shadow]);

  if (!enabled) return <section className="route-not-found" role="status"><h1>V2 pilot unavailable</h1><p>This non-production pilot is disabled.</p><button className="button button--primary" type="button" onClick={onExit}>Return home</button></section>;

  return <div className="v2-pilot-shell">
    <div className="v2-pilot-banner" role="status"><strong>V2 Pilot</strong><span>{shadow ? 'Shadow validation — progress is not saved' : 'Non-production Course session · Certification unavailable'}</span></div>
    <CourseRoute
      courseId={contentId}
      initialLessonId={lessonId}
      stage={stage}
      onEnterCourse={() => setStage('learning')}
      onShowOverview={() => setStage('overview')}
      onExitCourse={onExit}
      onLessonRoute={onLessonRoute}
      loaderRepository={bridge}
      progressRepositoryOverride={bridge.progressRepository}
      trustedCompletionService={disabledV2TrustedCompletionService}
      pilot
    />
  </div>;
}
