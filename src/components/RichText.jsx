function renderMarkdown(content) {
  const nodes = [];
  const lines = content.split('\n');
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {listItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);

    if (listMatch) {
      listItems.push(listMatch[1]);
      return;
    }

    flushList();
    if (trimmed) nodes.push(<p key={`paragraph-${nodes.length}`}>{trimmed}</p>);
  });
  flushList();

  return nodes;
}

export function RichText({ content, format = 'plain', className = '' }) {
  if (!content) return null;

  if (format === 'markdown') {
    return <div className={`rich-text ${className}`.trim()}>{renderMarkdown(content)}</div>;
  }

  return <p className={`rich-text rich-text-plain ${className}`.trim()}>{content}</p>;
}

