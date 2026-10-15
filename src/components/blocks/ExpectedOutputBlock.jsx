export function ExpectedOutputBlock({ output = '', expectedOutput = '', content }) {
  return (
    <section className="card card--inverse content-section code-card">
      <div className="block-header"><span>Example terminal output</span></div>
      <pre aria-label="Example terminal output"><code>{typeof output === 'string' ? output || expectedOutput || content || '' : output.default ?? ''}</code></pre>
    </section>
  );
}
