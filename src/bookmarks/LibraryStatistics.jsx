import { BookOpen, LibraryBig, Star, Trophy } from 'lucide-react';

export function LibraryStatistics({ counts }) {
  const statistics = [
    { label: 'Saved Courses', value: counts.course, icon: BookOpen },
    { label: 'Saved Practice Questions', value: counts.practice, icon: Star },
    { label: 'Saved Challenges', value: counts.challenge, icon: Trophy },
    { label: 'Total Saved', value: counts.all, icon: LibraryBig },
  ];
  return (
    <section className="library-statistics" aria-labelledby="library-statistics-title">
      <h2 id="library-statistics-title" className="sr-only">Library Statistics</h2>
      {statistics.map(({ label, value, icon: Icon }) => (
        <article key={label}><Icon aria-hidden="true" /><span><strong>{value}</strong><small>{label}</small></span></article>
      ))}
    </section>
  );
}
