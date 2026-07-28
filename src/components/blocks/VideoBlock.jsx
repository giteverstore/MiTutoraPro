export function VideoBlock({
  title,
  src,
  poster,
  caption,
  transcript,
  captions = [],
}) {
  return (
    <figure className="card card--surface content-section video-card">
      <video controls preload="metadata" poster={poster} aria-label={title}>
        <source src={src} />
        {captions.map((track) => (
          <track
            src={track.src}
            label={track.label}
            srcLang={track.language}
            kind="captions"
            key={`${track.language}-${track.src}`}
          />
        ))}
      </video>
      <figcaption>
        <strong>{title}</strong>
        {caption ? <span>{caption}</span> : null}
      </figcaption>
      {transcript ? (
        <details className="video-transcript">
          <summary>Transcript</summary>
          <p>{transcript}</p>
        </details>
      ) : null}
    </figure>
  );
}
