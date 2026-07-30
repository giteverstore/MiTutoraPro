import { Award, BarChart3, Clock3, GraduationCap } from 'lucide-react';

export function CertificateOverview({ overview }) {
  const items = [
    { label: 'Certificates Earned', value: overview.certificatesEarned, icon: Award },
    { label: 'Courses In Progress', value: overview.coursesInProgress, icon: GraduationCap },
    { label: 'Hours Certified', value: overview.hoursCertified, icon: Clock3 },
    { label: 'Completion Rate', value: `${overview.completionRate}%`, icon: BarChart3 },
  ];
  return (
    <section className="certificate-overview" aria-labelledby="certificate-overview-title">
      <h2 id="certificate-overview-title" className="sr-only">Certificate Overview</h2>
      {items.map(({ label, value, icon: Icon }) => (
        <article key={label}><Icon aria-hidden="true" /><span><strong>{value}</strong><small>{label}</small></span></article>
      ))}
    </section>
  );
}
