const COURSE_OVERVIEW_PRESENTATIONS = Object.freeze({
  python: Object.freeze({
    artwork: '/assets/course-overviews/python-course-hero.jpeg',
    eyebrow: 'Course',
    heading: 'Getting started\nwith Python',
    description: 'Step into the world of programming with this beginner-friendly Python course and build a strong programming foundation.',
    startLabel: 'Start this Course',
  }),
});

export function getCourseOverviewPresentation(courseId) {
  return COURSE_OVERVIEW_PRESENTATIONS[courseId] ?? null;
}
