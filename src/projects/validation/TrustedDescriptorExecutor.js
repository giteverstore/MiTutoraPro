import { getTrustedValidator, validateSchema } from '../../../shared/content/index.js';
import { normalizeProjectPath } from '../workspace/projectWorkspaceFiles.js';
import { ProjectExecutionService } from '../execution/ProjectExecutionService.js';
import { PROJECT_RUNTIME_DEFAULTS } from '../runtime/projectRuntimeDefaults.js';

export const VALIDATION_OUTPUT_LIMIT = 65_536;
const bounded = (value) => { const text=String(value??''); return { value:text.slice(0,VALIDATION_OUTPUT_LIMIT), truncated:text.length>VALIDATION_OUTPUT_LIMIT }; };
const resultingFiles = Symbol('resultingFiles');
const result = (descriptor, passed, message, extra={}) => ({ validatorId:descriptor.validatorId,type:descriptor.type,passed,message,durationMs:extra.durationMs??0,stdout:extra.stdout??'',stderr:extra.stderr??'',status:extra.status??(passed?'success':'failed'),truncated:extra.truncated===true,[resultingFiles]:extra.projectFiles });

export class TrustedDescriptorExecutor {
  constructor(compilerManager) { this.compilerManager=compilerManager; }
  async run({ descriptor, project, language, files, entrypoint, signal }) {
    const schema=validateSchema(descriptor,'validator');
    if(!schema.valid) return result(descriptor,false,'Validator descriptor is invalid.',{status:'configuration_error'});
    if(!getTrustedValidator(descriptor.type,descriptor.version)) return result(descriptor,false,'Validator type or version is not supported.',{status:'unsupported'});
    if(descriptor.languages?.length && !descriptor.languages.includes(language)) return result(descriptor,true,'Not applicable to the selected language.',{status:'not_applicable'});
    if(descriptor.type==='file_exists') { const paths=descriptor.configuration.paths??[descriptor.configuration.pathByLanguage?.[language]].filter(Boolean); const safe=paths.every(normalizeProjectPath); const passed=safe&&paths.every((path)=>files[path]); return result(descriptor,passed,passed?'Required files exist.':safe?'A required file is missing.':'Validator contains an unsafe path.'); }
    if(descriptor.type==='source_pattern') { const patterns=descriptor.configuration.patternsByLanguage?.[language]??descriptor.configuration.patterns??[]; const source=Object.values(files).map((file)=>file.content).join('\n'); const passed=patterns.length>0&&patterns.every((pattern)=>new RegExp(pattern,descriptor.configuration.caseInsensitive?'im':'m').test(source)); return result(descriptor,passed,passed?'Required source structure was found.':descriptor.failureMessage); }
    if(descriptor.type==='function_behavior') return result(descriptor,false,'Function behavior validation is not safely available for this language/runtime yet.',{status:'unsupported'});
    if(descriptor.type==='runtime_scenario'&&descriptor.configuration.requiresFilesystem&&PROJECT_RUNTIME_DEFAULTS[language]?.filesystem?.persistentRuns===false) return result(descriptor,true,'Filesystem verification is not supported by this browser runtime.',{status:'not_applicable'});
    const started=performance.now(); const e2eExecute=import.meta.env.MODE==='e2e'?globalThis.__YCODERS_PROJECT_E2E_EXECUTE__:null; const execution=e2eExecute?await e2eExecute({projectId:project.projectId,languageId:language,files,entrypoint,stdin:descriptor.configuration.stdin??'',validator:descriptor}):await new ProjectExecutionService(this.compilerManager).execute({projectId:project.projectId,languageId:language,files,entrypoint,stdin:descriptor.configuration.stdin??'',signal,timeoutMs:10_000}); const out=bounded(execution.stdout??execution.output); const err=bounded(execution.stderr??execution.errors?.join('\n')); let passed=execution.status==='success';
    if(descriptor.type==='output_contains') passed=passed&&(descriptor.configuration.values??[]).every((value)=>out.value.includes(String(value)));
    if(descriptor.type==='runtime_scenario') { const expectedFile=descriptor.configuration.filePathByLanguage?.[language]; const comparable=descriptor.configuration.outputCaseInsensitive?out.value.toLowerCase():out.value; passed=passed&&(!descriptor.configuration.requiresFilesystem||execution.filesystemSupported===true)&&(!expectedFile||(Boolean(normalizeProjectPath(expectedFile))&&Boolean(execution.projectFiles?.[expectedFile])))&&(descriptor.configuration.outputIncludes??[]).every((value)=>comparable.includes(descriptor.configuration.outputCaseInsensitive?String(value).toLowerCase():String(value))); }
    return result(descriptor,passed,passed?'Validation passed.':descriptor.failureMessage,{durationMs:Math.round(performance.now()-started),stdout:out.value,stderr:err.value,status:execution.status,truncated:out.truncated||err.truncated,projectFiles:execution.projectFiles});
  }
  async runScope(request, descriptors) { const results=[]; let files=request.files; for(const descriptor of descriptors) { const current=await this.run({...request,files,descriptor}); results.push(current); files=current[resultingFiles]??files; } return {passed:results.every((x)=>x.passed),results}; }
}
