import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { progressRepository } from '../progress/progressRepository';
import { browseCatalog } from './homeData';
import { loadActiveCourseCatalog, mergeCourseCatalog } from './canonicalCourseCatalog';
import { createHomeLearningModel } from './homeLearningModel';
import { BrowseCoursesSection } from './HomeSections';

export function LibraryPage({ onOpenCourse, anonymous = false, onRequireAuth = () => {} }) {
  const user = useUser({ optional: true })?.user;
  const [activeLanguage, setActiveLanguage] = useState('all');
  const [courseSearch, setCourseSearch] = useState('');
  const [progressRecords, setProgressRecords] = useState([]);
  const [publishedCourses, setPublishedCourses] = useState([]);
  useEffect(() => {
    let active = true;
    loadActiveCourseCatalog().then((courses) => { if (active) setPublishedCourses(courses); }, (error) => { console.warn('[Library] Published Course catalog could not be loaded.', error); });
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
  const enrollmentByCourse = useMemo(() => new Map(createHomeLearningModel({ progressRecords, publishedCourses }).enrollments.map((course) => [course.id, course])), [progressRecords, publishedCourses]);
  const languageCourses = useMemo(() => mergeCourseCatalog(browseCatalog.languages, publishedCourses).map((course) => {
    const enrollment = enrollmentByCourse.get(course.id);
    return { ...course, enrolled: Boolean(enrollment), started: Boolean(enrollment), progress: enrollment?.progress ?? null };
  }), [enrollmentByCourse, publishedCourses]);
  const languages = useMemo(() => [...new Set(languageCourses.map((course) => course.filter))], [languageCourses]);
  const languageGroups = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    const matches = languageCourses.filter((course) => {
      const matchesFilter = activeLanguage === 'all' || course.filter === activeLanguage;
      const searchable = [course.title, course.description, course.filter, course.kind].join(' ').toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
    return languages.map((language) => ({
      language,
      courses: matches.filter((course) => course.filter === language),
    })).filter((group) => group.courses.length > 0);
  }, [activeLanguage, courseSearch, languageCourses, languages]);

  return <div className="home-main library-main" id="library-content">
    <BrowseCoursesSection languageGroups={languageGroups} languages={languages}
      activeLanguage={activeLanguage} search={courseSearch}
      onLanguageChange={setActiveLanguage} onSearchChange={setCourseSearch} onOpenCourse={onOpenCourse}
      allowBookmarks={!anonymous} onRequireAuth={onRequireAuth} />
  </div>;
}
