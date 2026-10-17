import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { progressRepository } from '../progress/progressRepository';
import { browseCatalog } from './homeData';
import { loadActiveCourseCatalog, mergeCourseCatalog } from './canonicalCourseCatalog';
import { createHomeLearningModel } from './homeLearningModel';
import { BrowseCoursesSection } from './HomeSections';

export function groupLibraryCourses(courses, languages, activeLanguage, search) {
  const query = search.trim().toLowerCase();
  const matches = courses.filter((course) => {
    const matchesFilter = activeLanguage === 'all' || course.filter === activeLanguage;
    const searchable = [course.title, course.description, course.filter, course.kind].join(' ').toLowerCase();
    return matchesFilter && (!query || searchable.includes(query));
  });
  const comingSoonCourses = matches.filter((course) => course.available === false);
  const availableCourses = matches.filter((course) => course.available !== false);
  const languageGroups = languages.map((language) => ({
    language,
    courses: availableCourses.filter((course) => course.filter === language),
  })).filter((group) => group.courses.length > 0);
  return { comingSoonCourses, languageGroups };
}

export function LibraryPage({ onOpenCourse, anonymous = false, onRequireAuth = () => {} }) {
  const user = useUser({ optional: true })?.user;
  const [activeLanguage, setActiveLanguage] = useState('all');
  const [courseSearch, setCourseSearch] = useState('');
  const [progressRecords, setProgressRecords] = useState([]);
  const [catalog, setCatalog] = useState({ status: 'loading', courses: [] });
  useEffect(() => {
    let active = true;
    loadActiveCourseCatalog().then(
      (courses) => { if (active) setCatalog({ status: 'ready', courses }); },
      (error) => { if (active) setCatalog({ status: 'error', courses: [] }); console.warn('[Library] Published Course catalog could not be loaded.', error); },
    );
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    if (anonymous || !user?.id) { setProgressRecords([]); return undefined; }
    progressRepository.list(user.id).then(
      (records) => { if (active) setProgressRecords(records); },
      () => { if (active) setProgressRecords([]); },
    );
    return () => { active = false; };
  }, [anonymous, user?.id]);
  const enrollmentByCourse = useMemo(() => new Map(createHomeLearningModel({ progressRecords, publishedCourses: catalog.courses }).enrollments.map((course) => [course.id, course])), [progressRecords, catalog.courses]);
  const languageCourses = useMemo(() => mergeCourseCatalog(browseCatalog.languages, catalog.courses).map((course) => {
    const enrollment = enrollmentByCourse.get(course.id);
    return { ...course, enrolled: Boolean(enrollment), started: Boolean(enrollment), progress: enrollment?.progress ?? null };
  }), [enrollmentByCourse, catalog.courses]);
  const languages = useMemo(() => [...new Set(languageCourses.map((course) => course.filter))], [languageCourses]);
  const { comingSoonCourses, languageGroups } = useMemo(
    () => groupLibraryCourses(languageCourses, languages, activeLanguage, courseSearch),
    [activeLanguage, courseSearch, languageCourses, languages],
  );

  return <div className="home-main library-main" id="library-content">
    <BrowseCoursesSection comingSoonCourses={comingSoonCourses} languageGroups={languageGroups} languages={languages}
      activeLanguage={activeLanguage} search={courseSearch}
      onLanguageChange={setActiveLanguage} onSearchChange={setCourseSearch} onOpenCourse={onOpenCourse}
      allowBookmarks={!anonymous} onRequireAuth={onRequireAuth} loading={catalog.status === 'loading'} />
  </div>;
}
