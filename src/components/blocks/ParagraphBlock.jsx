import { RichText } from '../RichText';

export function ParagraphBlock({ content, paragraphs, format = 'plain' }) {
  if (!paragraphs) {
    return (
      <section className="content-section reading-copy">
        <RichText content={content} format={format} />
      </section>
    );
  }

  return (
    <section className="content-section reading-copy">
      {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </section>
  );
}
