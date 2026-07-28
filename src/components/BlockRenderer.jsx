import { resolveBlockComponent } from './blockRegistry';
import { EmptyState } from './EmptyState';

function RenderedBlock({ block }) {
  const { id, type, ...blockProps } = block;
  const BlockComponent = resolveBlockComponent(type);

  return <BlockComponent blockId={id} type={type} {...blockProps} />;
}

export function BlockRenderer({ lesson, emptyState }) {
  const blocks = lesson?.blocks ?? [];

  if (blocks.length === 0) {
    return (
      <div className="lesson-body">
        <EmptyState title={emptyState.title} description={emptyState.description} />
      </div>
    );
  }

  return (
    <div className="lesson-body">
      {blocks.map((block, index) => (
        <RenderedBlock block={block} key={block.id ?? `${block.type}-${index}`} />
      ))}
    </div>
  );
}
