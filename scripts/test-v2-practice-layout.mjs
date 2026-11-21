import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0}});await server.listen();
const base=server.resolvedUrls?.local?.[0];if(!base)throw new Error('Unable to resolve Vite URL.');
const browser=await chromium.launch({headless:true});
const cases=[{name:'desktop',width:1920,height:1080,split:true},{name:'laptop',width:1366,height:768,split:true},{name:'reduced-height',width:1024,height:600,split:true},{name:'narrow',width:800,height:900,split:false}];
const markup=`<div class="v2-pilot-shell"><div class="v2-pilot-banner">V2 PRACTICE PILOT · Version 2 · Nothing is saved</div><div class="v2-pilot-workspace"><div class="practice-immersive-workspace coding-workspace has-compiler v2-practice-shared-workspace" style="--compiler-width:680px;--lesson-pane-min:320px"><section class="practice-main-region coding-workspace__content"><article class="practice-problem"><div style="height:1600px">Problem</div></article></section><aside class="desktop-compiler compiler-dock shared-compiler-dock coding-workspace__compiler practice-compiler-dock is-expanded"><div class="compiler-dock-body"><div class="compiler-panel"><div class="compiler-ide"><header class="ide-header">Toolbar</header><div class="compiler-workspace compiler-workspace-editor-only"><div class="compiler-main-row"><div class="compiler-main-view compiler-editor-view"><div class="editor-window"><div class="monaco-editor-shell">Editor</div></div></div></div></div><section class="console-window ide-results" style="height:240px">Results</section></div></div></div></aside></div></div></div>`;
try{
  for(const item of cases){
    const page=await browser.newPage({viewport:{width:item.width,height:item.height}});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.evaluate(async(html)=>{await Promise.all([import('/src/styles/theme.css'),import('/src/design-system/tokens.css'),import('/src/design-system/primitives.css'),import('/src/styles/pages/learning-engine.css'),import('/src/styles/pages/practice.css'),import('/src/v2-pilot/v2-pilot.css')]);document.body.innerHTML=html;},markup);
    const measured=await page.evaluate(()=>{const box=(selector)=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};const workspaceStyle=getComputedStyle(document.querySelector('.practice-immersive-workspace')),compilerStyle=getComputedStyle(document.querySelector('.practice-compiler-dock'));return{shell:box('.v2-pilot-shell'),workspace:box('.practice-immersive-workspace'),problem:box('.practice-main-region'),compiler:box('.practice-compiler-dock'),editor:box('.compiler-editor-view'),monaco:box('.monaco-editor-shell'),results:box('.ide-results'),gridTemplate:workspaceStyle.gridTemplateColumns,compilerGridColumn:compilerStyle.gridColumn,compilerWidth:compilerStyle.width,problemOverflow:getComputedStyle(document.querySelector('.practice-problem')).overflowY};});
    console.log(JSON.stringify({viewport:item,...measured}));
    assert(measured.workspace.height>400,`${item.name}: workspace collapsed`);
    assert(measured.editor.width>250&&measured.editor.height>100,`${item.name}: editor collapsed`);
    assert(measured.monaco.width>250&&measured.monaco.height>100,`${item.name}: Monaco parent collapsed`);
    assert(measured.results.height>100,`${item.name}: results collapsed`);
    assert.equal(measured.problemOverflow,'auto',`${item.name}: problem is not independently scrollable`);
    if(item.split){assert(measured.problem.x<measured.compiler.x,`${item.name}: panes are not side by side`);assert(measured.problem.width>300&&measured.compiler.width>500,`${item.name}: unusable desktop pane widths`);}else assert(measured.compiler.y>=measured.problem.y,`${item.name}: narrow layout did not stack`);
    await page.close();
  }
}finally{await browser.close();await server.close();}
