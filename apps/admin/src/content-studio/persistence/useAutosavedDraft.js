import { useEffect, useRef, useState } from 'react';

export function useAutosavedDraft({ routeId, createDraft, repository, readOnly, onDirtyChange }) {
  const [draft, setDraft] = useState(() => createDraft(routeId));
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const currentDraft = useRef(draft);
  const editSequence = useRef(0);
  const savedSequence = useRef(0);
  const saveTail = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    repository.load(routeId ?? currentDraft.current.contentId).then((saved) => {
      if (active && saved && editSequence.current === 0) { currentDraft.current = saved; setDraft(saved); }
    }).catch((error) => { if (active) setSaveError(error.message); });
    return () => { active = false; };
  }, [routeId, repository]);

  useEffect(() => {
    onDirtyChange(dirty);
    if (!dirty || readOnly) return undefined;
    const timer = setTimeout(() => {
      saveTail.current = saveTail.current.catch(() => undefined).then(async () => {
        const snapshot = currentDraft.current;
        const generation = editSequence.current;
        if (generation <= savedSequence.current) return;
        try {
          const saved = await repository.save(snapshot);
          savedSequence.current = generation;
          const next = saved?.content
            ? generation === editSequence.current ? saved : { ...currentDraft.current, draftRevision: saved.draftRevision }
            : currentDraft.current;
          currentDraft.current = next;
          setDraft(next);
          if (generation === editSequence.current) setDirty(false);
          setSaveError('');
        } catch (error) { setSaveError(error.message); }
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [dirty, draft, readOnly, onDirtyChange, repository]);

  const edit = (change) => {
    if (readOnly) return;
    editSequence.current += 1;
    setDraft((current) => {
      const next = change(current);
      currentDraft.current = next;
      return next;
    });
    setDirty(true);
  };
  const reload = async () => {
    const saved = await repository.load(currentDraft.current.contentId);
    if (saved) { currentDraft.current = saved; setDraft(saved); editSequence.current = 0; savedSequence.current = 0; setDirty(false); setSaveError(''); }
  };
  return { draft, dirty, saveError, edit, reload };
}
