export function StudioDraftList({ drafts, type, emptyMessage, detail, onOpen }) {
  return <div className="project-draft-list studio-draft-list">{drafts.length ? drafts.map((draft) => {
    const id = draft.contentId ?? draft.documentId;
    const published = draft.lifecycleState === 'PUBLISHED';
    const updated = draft.updatedAt ?? draft.savedAt;
    return <button type="button" key={id} onClick={() => onOpen(draft)}>
      <span><strong>{draft.content.title}</strong><small>{type} · {detail(draft)}</small></span>
      <span className="studio-draft-meta"><span>{published ? 'Published' : 'Draft'}{draft.activeVersion ? ` · ACTIVE v${draft.activeVersion}` : ''}</span><small>{updated ? `Updated ${new Date(updated).toLocaleDateString()}` : `Revision ${draft.draftRevision ?? 0}`}</small><b>Open / Edit</b></span>
    </button>;
  }) : <p>{emptyMessage}</p>}</div>;
}
