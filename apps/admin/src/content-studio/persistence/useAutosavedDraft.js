import { useEffect, useRef, useState } from 'react';

const SAVE_DELAY_MS = 650;

export function useAutosavedDraft({ routeId, createDraft, repository, readOnly, onDirtyChange }) {
  const [draft, setDraft] = useState(() => createDraft(routeId));
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const session = useRef(null);
  if (!session.current) {
    session.current = {
      draft, revision: draft.draftRevision ?? 0, editSequence: 0, savedSequence: 0,
      inFlight: null, timer: null, conflict: false, loading: Boolean(routeId), epoch: 0,
    };
  }
  const current = session.current;
  const options = useRef({ repository, readOnly });
  options.current = { repository, readOnly };

  const schedule = () => {
    clearTimeout(current.timer);
    if (options.current.readOnly || current.conflict || current.loading || current.editSequence <= current.savedSequence) return;
    current.timer = setTimeout(() => { current.timer = null; void flush(); }, SAVE_DELAY_MS);
  };

  const flush = async () => {
    if (current.inFlight || current.conflict || current.loading || options.current.readOnly || current.editSequence <= current.savedSequence) return;
    const epoch = current.epoch;
    const sequence = current.editSequence;
    const revision = current.revision;
    const snapshot = { ...current.draft, draftRevision: revision };
    // Pass the authoritative revision explicitly, even after edits during a prior save.
    const operation = Promise.resolve().then(() => options.current.repository.save(snapshot, revision));
    current.inFlight = operation;
    let succeeded = false;
    try {
      const saved = await operation;
      if (epoch !== current.epoch) return;
      if (saved?.draftRevision != null) current.revision = saved.draftRevision;
      current.savedSequence = sequence;
      current.draft = sequence === current.editSequence && saved?.content
        ? saved
        : { ...current.draft, draftRevision: current.revision };
      setDraft(current.draft);
      if (sequence === current.editSequence) setDirty(false);
      setSaveError('');
      succeeded = true;
    } catch (error) {
      if (epoch !== current.epoch) return;
      if (error.code === 'content/draft-conflict') current.conflict = true;
      setSaveError(error.message);
    } finally {
      if (current.inFlight === operation) current.inFlight = null;
      // Coalesce edits made while pending. Never automatically retry a failure or 409.
      if (succeeded && epoch === current.epoch) schedule();
    }
  };

  useEffect(() => {
    const epoch = ++current.epoch;
    let active = true;
    repository.load(routeId ?? current.draft.contentId ?? current.draft.documentId).then((saved) => {
      if (active && epoch === current.epoch) {
        current.loading = false;
        if (saved && current.editSequence === 0) {
          current.draft = saved;
          current.revision = saved.draftRevision ?? 0;
          setDraft(saved);
        } else if (saved) {
          // Never save an edited placeholder over an existing draft that loaded late.
          current.conflict = true;
          setSaveError('This draft finished loading after editing began. Reload the latest version before saving.');
        }
      }
    }).catch((error) => { if (active && epoch === current.epoch) { current.loading = false; setSaveError(error.message); } });
    return () => { active = false; ++current.epoch; clearTimeout(current.timer); };
  }, [routeId, repository]);

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  const edit = (change) => {
    if (options.current.readOnly) return;
    current.draft = change(current.draft);
    current.editSequence += 1;
    setDraft(current.draft);
    setDirty(true);
    schedule();
  };

  const reload = async () => {
    clearTimeout(current.timer);
    const epoch = ++current.epoch;
    try {
      // Let an already-dispatched write settle before reading its authoritative revision.
      await current.inFlight?.catch(() => undefined);
      const saved = await options.current.repository.load(current.draft.contentId ?? current.draft.documentId);
      if (epoch !== current.epoch || !saved) return;
      current.draft = saved;
      current.revision = saved.draftRevision ?? 0;
      current.loading = false;
      current.editSequence = 0;
      current.savedSequence = 0;
      current.conflict = false;
      setDraft(saved);
      setDirty(false);
      setSaveError('');
    } catch (error) {
      if (epoch === current.epoch) setSaveError(error.message);
    }
  };

  return { draft, dirty, saveError, edit, reload };
}
