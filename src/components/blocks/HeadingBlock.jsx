export function HeadingBlock({ eyebrow, text, level, kicker, title }) {
  const Heading = `h${level ?? 2}`;

  return (
    <section className="content-section">
      {(eyebrow || kicker) ? <span className="section-kicker">{eyebrow || kicker}</span> : null}
      <Heading>{text || title}</Heading>
    </section>
  );
}
