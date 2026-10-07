import { describe, expect, it, vi } from 'vitest';
import { TrustedDescriptorExecutor, VALIDATION_OUTPUT_LIMIT } from '../../../src/projects/validation/TrustedDescriptorExecutor.js';
const descriptor=(type,configuration={})=>({validatorId:`test-${type}`,type,version:1,severity:'error',configuration,failureMessage:'Author-facing failure.'});
const request={project:{projectId:'preview'},language:'python',entrypoint:'main.py',files:{'main.py':{path:'main.py',content:'print("Hello")'}}};
describe('trusted descriptor execution',()=>{
  it('resolves versioned descriptors and rejects unknown versions',async()=>{const executor=new TrustedDescriptorExecutor({execute:vi.fn()});expect((await executor.run({...request,descriptor:{...descriptor('execution_succeeds'),version:2}})).status).toBe('configuration_error')});
  it('runs source and file checks without compiler execution',async()=>{const execute=vi.fn();const executor=new TrustedDescriptorExecutor({execute});expect((await executor.run({...request,descriptor:descriptor('file_exists',{paths:['main.py']})})).passed).toBe(true);expect((await executor.run({...request,descriptor:descriptor('source_pattern',{patterns:['Hello']})})).passed).toBe(true);expect(execute).not.toHaveBeenCalled()});
  it('normalizes bounded runtime output',async()=>{const executor=new TrustedDescriptorExecutor({execute:vi.fn().mockResolvedValue({status:'success',stdout:'x'.repeat(VALIDATION_OUTPUT_LIMIT+10),stderr:'',executionTimeMs:2})});const value=await executor.run({...request,descriptor:descriptor('execution_succeeds')});expect(value.passed).toBe(true);expect(value.stdout).toHaveLength(VALIDATION_OUTPUT_LIMIT);expect(value.truncated).toBe(true)});
  it('reports function behavior honestly as unsupported',async()=>{const value=await new TrustedDescriptorExecutor({execute:vi.fn()}).run({...request,descriptor:descriptor('function_behavior',{cases:[{args:[],expected:true}]})});expect(value.status).toBe('unsupported')});
});
