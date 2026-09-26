import assert from 'node:assert/strict';
import { DockerExecutor } from '../tools/remote-compiler-runner/DockerExecutor.mjs';
import { BoundedExecutor } from '../tools/remote-compiler-runner/BoundedExecutor.mjs';

const executor = new DockerExecutor();
const hello = 'package main\nimport "fmt"\nfunc main(){fmt.Println("Hello, World!")}';
const runs = [];
for (let index = 0; index < 5; index += 1) {
  const started = performance.now();
  const result = await executor.execute({ language: 'go', source: hello, stdin: '' });
  const totalMs = Math.round(performance.now() - started);
  assert.equal(result.status, 'success');
  runs.push({ totalMs, compileTimeMs: result.compileTimeMs, executionTimeMs: result.executionTimeMs, ...result.phaseTimings });
}

const marker = `ycoders-cache-isolation-${Date.now()}`;
const writer = await executor.execute({ language: 'go', source: `package main
import("fmt";"os")
func main(){
  _=os.WriteFile("/work/${marker}",[]byte("learner"),0600)
  _=os.WriteFile("/tmp/${marker}",[]byte("learner"),0600)
  err:=os.WriteFile("/opt/ycoders-go-cache/${marker}",[]byte("poison"),0600)
  fmt.Println(err!=nil)
}`, stdin: '' });
assert.equal(writer.status, 'success');
assert.equal(writer.stdout.trim(), 'true');

const reader = await executor.execute({ language: 'go', source: `package main
import("fmt";"os")
func main(){
  _,work:=os.Stat("/work/${marker}")
  _,temp:=os.Stat("/tmp/${marker}")
  _,cache:=os.Stat("/opt/ycoders-go-cache/${marker}")
  fmt.Println(os.IsNotExist(work),os.IsNotExist(temp),os.IsNotExist(cache))
}`, stdin: '' });
assert.equal(reader.status, 'success');
assert.equal(reader.stdout.trim(), 'true true true');

async function concurrent(count) {
  const bounded = new BoundedExecutor(new DockerExecutor());
  const started = performance.now();
  const settled = await Promise.allSettled(Array.from({ length: count }, () => bounded.execute({ language: 'go', source: hello, stdin: '' })));
  const completed = settled.filter(({ status }) => status === 'fulfilled').map(({ value }) => value);
  const rejected = settled.filter(({ status }) => status === 'rejected').map(({ reason }) => reason.message);
  assert.ok(completed.every((result) => result.status === 'success'));
  if (count <= 4) assert.equal(rejected.length, 0);
  if (count === 5) assert.deepEqual(rejected, ['runner_busy']);
  return { count, totalMs: Math.round(performance.now() - started), jobs: completed.map((result) => result.totalTimeMs), rejected };
}

const concurrency = [await concurrent(1), await concurrent(2), await concurrent(4), await concurrent(5)];
const totals = runs.map(({ totalMs }) => totalMs).sort((a, b) => a - b);
console.log(JSON.stringify({
  runs,
  distribution: { minMs: totals[0], medianMs: totals[Math.floor(totals.length / 2)], maxMs: totals.at(-1) },
  cacheIsolation: { previousWorkAbsent: true, previousTmpAbsent: true, immutableCacheWriteDenied: true, poisonAbsent: true },
  concurrency,
}, null, 2));
