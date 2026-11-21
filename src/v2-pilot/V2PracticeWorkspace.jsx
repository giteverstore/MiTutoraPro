import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { EditorHeader } from '../components/EditorHeader';
import { EditorPlaceholder } from '../components/EditorPlaceholder';
import { CompilerLanguageSelector } from '../components/CompilerLanguageSelector';
import { OutputPanel } from '../components/OutputPanel';
import { PracticeProblemContent } from '../practice/PracticeProblemContent';
import { PracticeWorkspaceFrame } from '../practice/PracticeWorkspaceFrame';
import { useCompilerManager } from '../compiler/CompilerProvider';
import { LAYOUT_SIZE } from '../design-system/theme';
import { executeV2Practice } from './V2PracticeExecution';
import { createV2PracticeViewModel } from './V2PracticeViewModel';

const extensions={python:'py',javascript:'js',typescript:'ts',java:'java',c:'c',cpp:'cpp',php:'php',r:'R',csharp:'cs'};
function editorDefinition(practice,language,source){const fileName=`main.${extensions[language]??'txt'}`;return{id:`v2-${practice.identity.contentId}-${language}`,language,editor:{language,fileName,ariaLabel:`${language} Practice editor`,modelPath:`inmemory://v2-practice/${practice.identity.contentId}/v${practice.identity.publicationVersion}/${fileName}`,lines:source.split('\n').map((text,index)=>({number:index+1,text,tone:'source'}))}};}

export function V2PracticeWorkspace({practice,onExit,executionClient=executeV2Practice}){
  const compilerManager=useCompilerManager();
  const viewModel=useMemo(()=>createV2PracticeViewModel(practice),[practice]);
  const starters=useMemo(()=>Object.fromEntries(practice.starterCode.map(({languageId,code})=>[languageId,code])),[practice]);
  const [language,setLanguage]=useState(practice.languages.defaultLanguageId),[sources,setSources]=useState(starters),[run,setRun]=useState({status:'idle',tests:[],message:''});
  const source=sources[language]??'',busy=['preparing','running'].includes(run.status),definition=editorDefinition(practice,language,source);
  const options=practice.languages.supported.map((item)=>({id:item.id,label:item.displayName??item.id,available:true}));
  const publicTests=practice.publicTests.map((test)=>({name:test.id,arguments:test.arguments?.map(({value})=>value)??[test.stdin],expected:test.expectedResult?.value??test.expectedOutput}));
  const functionResults=run.status==='error'?[]:run.tests.map((test)=>({id:test.id,passed:test.status==='passed',status:test.status==='failed'?'wrong_answer':test.status,actual:test.actual,expected:test.expected,message:test.message}));
  const executionStatus=run.status==='error'?'error':run.status==='idle'?'idle':busy?'running':'success';
  async function execute(){if(busy)return;setRun({status:'preparing',tests:[],message:'Preparing runtime…'});await Promise.resolve();setRun({status:'running',tests:[],message:'Running public tests…'});try{setRun(await executionClient({compilerManager,practice,language,source,instanceId:`v2-practice-${practice.identity.contentId}-v${practice.identity.publicationVersion}`}));}catch(error){setRun({status:'error',tests:[],message:error.message});}}
  function reset(){setSources((current)=>({...current,[language]:starters[language]??''}));setRun({status:'idle',tests:[],message:''});}
  return <PracticeWorkspaceFrame compilerWidth={680} lessonPaneMin={LAYOUT_SIZE.lesson.min} className="v2-practice-shared-workspace">
    <section className="practice-main-region coding-workspace__content"><article className="practice-problem lesson-panel">
      <header className="practice-detail-header"><button className="practice-back-button" type="button" onClick={onExit}><ArrowLeft/> Back to Practice</button><div className="v2-practice-meta"><span>{practice.difficulty}</span><span>{practice.estimatedMinutes} minutes</span>{viewModel.tags.map((tag)=><span key={tag}>{tag}</span>)}</div><h1>{practice.title}</h1></header>
      <PracticeProblemContent question={viewModel}/>
    </article></section>
    <aside className={`desktop-compiler compiler-dock shared-compiler-dock coding-workspace__compiler practice-compiler-dock is-expanded compiler-enter is-${busy?'running':'ready'}`} aria-label="V2 Practice compiler"><div className="compiler-dock-body"><div className="compiler-panel"><div className="compiler-ide">
      <EditorHeader data={definition} isRunning={busy} executionStatus={executionStatus} verificationStatus={run.status==='passed'?'matched':run.status==='failed'?'mismatched':'idle'} onRun={execute} onReset={reset} languageSelector={<CompilerLanguageSelector value={language} options={options} disabled={busy} onChange={setLanguage}/>} />
      <div className="compiler-workspace compiler-workspace-editor-only"><div className="compiler-main-row"><div className="compiler-main-view compiler-editor-view"><EditorPlaceholder editor={definition.editor} value={source} onChange={(value)=>setSources((current)=>({...current,[language]:value}))} instanceId={`v2-practice-${practice.identity.contentId}`}/></div></div></div>
      <OutputPanel result={run.message} error={run.status==='error'?run.message:''} isRunning={busy} expectedOutput={publicTests[0]?.expected} executionStatus={executionStatus} verificationStatus={run.status==='passed'?'matched':run.status==='failed'?'mismatched':'idle'} tests={publicTests} functionResults={functionResults} showCheckOutput={false} collapsed={false}/>
    </div></div></div></aside>
  </PracticeWorkspaceFrame>;
}
