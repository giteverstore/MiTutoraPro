import { useEffect, useMemo, useState } from 'react';
import { useCompilerManager } from '../compiler/CompilerProvider';
import MonacoCodeEditor from '../components/MonacoCodeEditor';
import { executeV2Practice } from './V2PracticeExecution';

const extensions={python:'py',javascript:'js',typescript:'ts',java:'java',c:'c',cpp:'cpp',php:'php',r:'r',csharp:'cs'};
export function V2PracticeWorkspace({practice,executionClient=executeV2Practice}){
  const compilerManager=useCompilerManager(),defaultLanguage=practice.languages.defaultLanguageId;
  const starters=useMemo(()=>Object.fromEntries(practice.starterCode.map(({languageId,code})=>[languageId,code])),[practice]);
  const [language,setLanguage]=useState(defaultLanguage),[sources,setSources]=useState(starters),[run,setRun]=useState({status:'idle',tests:[]});
  useEffect(()=>{setLanguage(defaultLanguage);setSources(starters);setRun({status:'idle',tests:[]});},[defaultLanguage,starters,practice.identity.publicationVersion]);
  const source=sources[language]??'', busy=['preparing','running'].includes(run.status);
  async function execute(){if(busy)return;setRun({status:'preparing',tests:[]});await Promise.resolve();setRun({status:'running',tests:[]});try{setRun(await executionClient({compilerManager,practice,language,source,instanceId:`v2-practice-${practice.identity.contentId}-v${practice.identity.publicationVersion}`}));}catch(error){setRun({status:'error',tests:[],message:error.message});}}
  return <section className="v2-practice-workspace" aria-labelledby="workspace-title"><div className="v2-practice-code-heading"><h2 id="workspace-title">Code workspace</h2><label>Language <select value={language} disabled={busy} onChange={(event)=>setLanguage(event.target.value)}>{practice.languages.supported.map((item)=><option key={item.id} value={item.id}>{item.displayName??item.id}</option>)}</select></label></div>
    <div className="v2-practice-editor"><MonacoCodeEditor instanceId="v2-practice-editor" editor={{language,modelPath:`inmemory://v2-practice/${practice.identity.contentId}/v${practice.identity.publicationVersion}/main.${extensions[language]??'txt'}`,fileName:`main.${extensions[language]??'txt'}`,ariaLabel:`${language} Practice editor`}} value={source} onChange={(value)=>setSources((current)=>({...current,[language]:value}))}/></div>
    <div className="v2-practice-run"><button type="button" onClick={execute} disabled={busy}>{busy?'Running…':'Run'}</button><span role="status">{run.status==='idle'?'Ready':run.message??run.status}</span></div>
    {run.tests.length?<div className="v2-practice-results" aria-label="Public test results"><h3>Public tests</h3><ul>{run.tests.map((test)=><li key={test.id} data-status={test.status}><strong>{test.label}</strong>: {test.status}{test.status==='failed'?<span> · expected {JSON.stringify(test.expected)}, received {JSON.stringify(test.actual)}</span>:null}{test.status==='error'?<span> · {test.message}</span>:null}</li>)}</ul></div>:null}
  </section>;
}
