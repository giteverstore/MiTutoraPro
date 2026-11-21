import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

Object.assign(process.env, {
  VITE_FIREBASE_API_KEY:'demo', VITE_FIREBASE_AUTH_DOMAIN:'demo.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID:'demo-v2-practice', VITE_FIREBASE_STORAGE_BUCKET:'demo.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID:'1', VITE_FIREBASE_APP_ID:'1:1:web:1',
});

const server=await createServer({ logLevel:'error', server:{ host:'127.0.0.1', port:0 } });
await server.listen();
const baseUrl=server.resolvedUrls?.local?.[0];
if(!baseUrl) throw new Error('Unable to resolve local Vite URL.');
const browser=await chromium.launch({ headless:true });
const page=await browser.newPage();

try {
  await page.goto(`${baseUrl}dotnet/main.js`, { waitUntil:'domcontentloaded', timeout:30_000 });
  const results=await page.evaluate(async () => {
    const [{ createCompilerManager }, { executeV2Practice }]=await Promise.all([
      import('/src/compiler/createCompilerManager.js'), import('/src/v2-pilot/V2PracticeExecution.js'),
    ]);
    const manager=createCompilerManager();
    const practice={
      questionId:'p5-browser-proof', identity:{ contentId:'p5-browser-proof', publicationVersion:2 },
      execution:{ mode:'function', adapterFamily:'return-value', entrypoint:'add', arguments:[{ name:'a', type:'integer' },{ name:'b', type:'integer' }], result:{ type:'integer' }, resultSource:{ kind:'return-value' } },
      publicTests:[
        { id:'positive', label:'positive values', arguments:[{ value:1 },{ value:2 }], expectedResult:{ value:3 }, comparison:{ kind:'json-equivalent' } },
        { id:'mixed', label:'mixed values', arguments:[{ value:-4 },{ value:9 }], expectedResult:{ value:5 }, comparison:{ kind:'json-equivalent' } },
      ],
    };
    const sources={
      python:{ correct:'def add(a, b):\n    return a + b', incorrect:'def add(a, b):\n    return 0', syntax:'def add(a, b)\n    return a + b' },
      javascript:{ correct:'function add(a, b) { return a + b; }', incorrect:'function add(a, b) { return 0; }', syntax:'function add(a, b) { return a + ; }' },
    };
    const outcomes={};
    try {
      for(const [language,cases] of Object.entries(sources)){
        outcomes[language]={};
        for(const [name,source] of Object.entries(cases)) outcomes[language][name]=await executeV2Practice({ compilerManager:manager, practice, language, source, instanceId:`p5-${language}-${name}` });
      }
    } finally { await manager.dispose(); }
    return outcomes;
  });
  for(const language of ['python','javascript']){
    assert.equal(results[language].correct.status,'passed',`${language} correct case failed`);
    assert.equal(results[language].correct.tests.length,2,`${language} did not run every public test`);
    assert.equal(results[language].incorrect.status,'failed',`${language} incorrect case did not fail`);
    assert.equal(results[language].syntax.status,'error',`${language} syntax case did not error`);
  }
  console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([language,cases])=>[language,Object.fromEntries(Object.entries(cases).map(([name,result])=>[name,{ status:result.status, tests:result.tests.map(({ status,errorKind })=>({ status,errorKind })) }]))])),null,2));
} finally { await browser.close(); await server.close(); }
