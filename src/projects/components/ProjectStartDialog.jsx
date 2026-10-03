import { useEffect, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { listProjectRuntimes } from '../runtime/projectRuntimeRegistry';

export function ProjectStartDialog({ open, project, initialLanguageId, onClose, onConfirm }) {
  const [languageId, setLanguageId] = useState(initialLanguageId ?? project.supportedLanguages[0]);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { if (open) { setLanguageId(initialLanguageId ?? project.supportedLanguages[0]); setConfirming(false); } }, [initialLanguageId, open, project]);
  const runtimes = listProjectRuntimes(project);
  const selected = runtimes.find(({ id }) => id === languageId);
  return <Dialog open={open} title={confirming ? `Start with ${selected?.displayName}` : 'Choose your project language'} description={confirming ? 'This language becomes active for this project.' : 'The same project guide adapts to the runtime you choose.'} onClose={onClose} className="project-start-dialog">
    {!confirming ? <><div className="project-start-languages" role="radiogroup" aria-label="Supported project languages">{runtimes.map((runtime) => <button data-autofocus={runtime.id === languageId ? '' : undefined} type="button" role="radio" aria-checked={runtime.id === languageId} className={runtime.id === languageId ? 'is-selected' : ''} onClick={() => setLanguageId(runtime.id)} key={runtime.id}><span><strong>{runtime.displayName}</strong><small>{runtime.runtime} · {runtime.entrypoint}</small></span>{runtime.id === languageId ? <Check aria-hidden="true" /> : null}</button>)}</div><div className="project-start-actions"><button className="button button--secondary" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" type="button" onClick={() => setConfirming(true)}>Continue</button></div></> : <><div className="project-language-warning"><strong>{selected?.displayName} will be locked for this active project.</strong><p>Changing language later resets checkpoint progress and workspace files. Version 1 does not retain previous attempts.</p></div><div className="project-start-actions"><button className="button button--secondary" type="button" onClick={() => setConfirming(false)}><ArrowLeft /> Back</button><button className="button button--primary" type="button" onClick={() => onConfirm(languageId)}>Initialize Project</button></div></>}
  </Dialog>;
}
