import assert from 'node:assert/strict';
import { DockerExecutor } from '../tools/remote-compiler-runner/DockerExecutor.mjs';

const executor = new DockerExecutor();
const results = [];
async function run(name, language, source, check) {
  const started = performance.now();
  const result = await executor.execute({ language, source });
  const totalMs = Math.round(performance.now() - started);
  console.log(`${name}: ${result.status} (${totalMs}ms) truncated=${result.truncated}`);
  check(result); results.push({ name, status: result.status, totalMs, truncated: result.truncated });
}

await run('go-filesystem-proc-process', 'go', `package main
import("fmt";"os";"os/exec")
func main(){_,etc:=os.ReadFile("/etc/os-release");_,proc:=os.ReadDir("/proc");host:=os.WriteFile("/etc/ycoders-test",[]byte("x"),0600);parent:=os.WriteFile("../escape",[]byte("x"),0600);out,child:=exec.Command("/bin/sh","-c","printf child").CombinedOutput();fmt.Printf("etc=%t proc=%t hostWrite=%t parentDenied=%t child=%s childErr=%t\\n",etc==nil,proc==nil,host!=nil,parent!=nil,string(out),child!=nil)}`, (r) => { assert.equal(r.status,'success'); assert.match(r.stdout,/etc=true proc=true hostWrite=true parentDenied=true child=child childErr=false/); });
await run('rust-filesystem-proc-process', 'rust', `use std::{fs,process::Command};fn main(){let etc=fs::read("/etc/os-release").is_ok();let proc=fs::read_dir("/proc").is_ok();let host=fs::write("/etc/ycoders-test",b"x").is_err();let parent=fs::write("../escape",b"x").is_err();let child=Command::new("/bin/sh").args(["-c","printf child"]).output().unwrap();println!("etc={} proc={} hostWrite={} parentDenied={} child={}",etc,proc,host,parent,String::from_utf8_lossy(&child.stdout));}`, (r) => { assert.equal(r.status,'success'); assert.match(r.stdout,/etc=true proc=true hostWrite=true parentDenied=true child=child/); });
await run('go-stdout-limit', 'go', `package main
import("fmt";"strings")
func main(){for i:=0;i<1200;i++{fmt.Println(strings.Repeat("x",1024))}}`, (r) => { assert.equal(r.status,'output_limit'); assert.equal(r.truncated,true); assert.ok(Buffer.byteLength(r.stdout)<=1048576); });
await run('rust-stderr-limit', 'rust', `fn main(){let s="x".repeat(1024);for _ in 0..1200{eprintln!("{}",s);}}`, (r) => { assert.equal(r.status,'output_limit'); assert.equal(r.truncated,true); assert.ok(Buffer.byteLength(r.stderr)<=1048576); });
await run('go-per-file-limit', 'go', `package main
import("fmt";"os")
func main(){f,_:=os.Create("/work/large");defer f.Close();b:=make([]byte,1024*1024);ok:=true;for i:=0;i<70;i++{if _,e:=f.Write(b);e!=nil{ok=false;break}};fmt.Println(ok)}`, (r) => { assert.equal(r.status,'success'); assert.equal(r.stdout,'false\n'); });
await run('rust-aggregate-disk-limit', 'rust', `use std::{fs::File,io::Write};fn main(){let b=vec![0u8;1024*1024];let mut count=0;for i in 0..120{match File::create(format!("/work/f{}",i)).and_then(|mut f|f.write_all(&b)){Ok(_)=>count+=1,Err(_)=>break}}println!("{}",count);}`, (r) => { assert.equal(r.status,'success'); const count=Number(r.stdout.trim()); assert.ok(count<96 && count>0); });
await run('rust-memory-oom', 'rust', `fn main(){let mut chunks=Vec::new();loop{chunks.push(vec![1u8;16*1024*1024]);println!("{}",chunks.len());}}`, (r) => { assert.ok(['runtime_error','infrastructure_error'].includes(r.status)); });

const aborter=new AbortController();
const cancelled=executor.execute({language:'rust',source:'fn main(){loop{}}',signal:aborter.signal});
setTimeout(()=>aborter.abort(),2500);
const cancelledResult=await cancelled;
assert.equal(cancelledResult.status,'cancelled');
results.push({name:'rust-cancellation',status:cancelledResult.status});
console.log('rust-cancellation: cancelled');

console.log(JSON.stringify({passed:results.length,results},null,2));
