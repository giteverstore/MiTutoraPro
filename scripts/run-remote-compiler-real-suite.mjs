import assert from 'node:assert/strict';
import { DockerExecutor } from '../tools/remote-compiler-runner/DockerExecutor.mjs';

const executor = new DockerExecutor();
const results = [];
const startAt = process.env.YCODERS_REAL_SUITE_START_AT ?? '';
let reachedStart = startAt === '';
async function run(name, language, source, stdin = '', check = () => {}) {
  if (!reachedStart) {
    if (name !== startAt) return null;
    reachedStart = true;
  }
  const started = performance.now(); const result = await executor.execute({ language, source, stdin }); const totalMs = Math.round(performance.now() - started); console.log(`${name}: ${result.status} (${totalMs}ms; compile=${result.compileTimeMs ?? 'n/a'}ms; run=${result.executionTimeMs ?? 'n/a'}ms)${result.stderr ? ` stderr=${JSON.stringify(result.stderr.slice(0, 300))}` : ''}`); check(result); results.push({ name, language, status: result.status, stdout: result.stdout, stderr: result.stderr, totalMs, compileTimeMs: result.compileTimeMs, executionTimeMs: result.executionTimeMs, phaseTimings: result.phaseTimings, toolchainVersion: result.toolchainVersion, truncated: result.truncated }); return result;
}

await run('go-hello', 'go', `package main
import "fmt"
func main(){fmt.Println("Hello, World!")}`, '', (r) => { assert.equal(r.status, 'success'); assert.equal(r.stdout, 'Hello, World!\n'); });
await run('go-language', 'go', `package main
import("encoding/json";"errors";"fmt";"regexp";"sort";"strings";"time")
type Box[T any] struct{V T}; type Speaker interface{Speak() string}; type Person struct{Name string}; func(p *Person)Speak()string{return p.Name}; func pair()(int,int){return 2,3}
func main(){a,b:=pair(); xs:=[]int{3,1,2}; sort.Ints(xs); m:=map[string]int{"x":1}; p:=&Person{"ok"}; f:=func(x int)int{return x*2}; data,_:=json.Marshal(Box[int]{5}); _=errors.New("e"); _=time.Millisecond; fmt.Println(a+b,xs,m["x"],p.Speak(),f(4),strings.ToUpper("go"),regexp.MustCompile("G.").MatchString("GO"),string(data))}`, '', (r) => { assert.equal(r.status, 'success'); assert.match(r.stdout, /5 \[1 2 3\] 1 ok 8 GO true/); });
await run('go-channel-generics', 'go', `package main
import "fmt"
func Sum[T int|int64|float64](a,b T)T{return a+b}
func main(){ch:=make(chan int);go func(){ch<-42}();fmt.Println(<-ch,Sum(10,20))}`, '', (r) => { assert.equal(r.stdout, '42 30\n'); });
await run('go-stdin-streams', 'go', `package main
import("bufio";"fmt";"os")
func main(){in:=bufio.NewReader(os.Stdin);var n int;fmt.Fscan(in,&n);line,_:=in.ReadString(10);fmt.Println(n*2,line);fmt.Fprintln(os.Stderr,"go-error")}`, '5 hello\n', (r) => { assert.equal(r.status, 'success'); assert.match(r.stdout, /10/); assert.equal(r.stderr, 'go-error\n'); });
await run('go-compile-error', 'go', `package main
func main(){missing}`, '', (r) => { assert.equal(r.status, 'compile_error'); assert.match(r.stderr, /main\.go.*undefined: missing/s); });
await run('go-panic', 'go', `package main
func main(){panic("test")}`, '', (r) => { assert.equal(r.status, 'runtime_error'); assert.match(r.stderr, /panic: test/); });
await run('go-network-denied', 'go', `package main
import("fmt";"net")
func main(){_,e:=net.DialTimeout("tcp","1.1.1.1:80",1000000000);fmt.Println(e!=nil)}`, '', (r) => { assert.equal(r.status, 'success'); assert.equal(r.stdout, 'true\n'); });
await run('go-environment', 'go', `package main
import("fmt";"os";"strings")
func main(){found:=false;for _,entry:=range os.Environ(){if strings.HasPrefix(entry,"YCODERS_SYNTHETIC_HOST_SECRET="){found=true}};fmt.Println(found)}`, '', (r) => { assert.equal(r.stdout, 'false\n'); });

await run('rust-hello', 'rust', `fn main(){println!("Hello, World!");}`, '', (r) => { assert.equal(r.status, 'success'); assert.equal(r.stdout, 'Hello, World!\n'); });
await run('rust-language', 'rust', `use std::collections::HashMap; trait Speak{fn speak(&self)->&str;} struct Person{name:String} impl Speak for Person{fn speak(&self)->&str{&self.name}} enum Choice{Some(i32),None} fn twice<T:std::ops::Add<Output=T>+Copy>(v:T)->T{v+v} fn main(){let mut v=vec![1,2,3];v.push(4);let mut m=HashMap::new();m.insert("x",5);let p=Person{name:"ok".into()};let c=Choice::Some(7);let _n=Choice::None;let n=match c{Choice::Some(x)=>x,Choice::None=>0};let sum:i32=v.iter().map(|x|x*2).sum();println!("{} {} {} {} {}",sum,m["x"],p.speak(),n,twice(6));}`, '', (r) => { assert.equal(r.status, 'success'); assert.equal(r.stdout, '20 5 ok 7 12\n'); });
await run('rust-borrow-e0382', 'rust', `fn main(){let s=String::from("hello");let _x=s;println!("{}",s);}`, '', (r) => { assert.equal(r.status, 'compile_error'); assert.match(r.stderr, /E0382/); });
await run('rust-borrow-e0502', 'rust', `fn main(){let mut v=vec![1];let r=&v[0];v.push(2);println!("{}",r);}`, '', (r) => { assert.equal(r.status, 'compile_error'); assert.match(r.stderr, /E0502/); });
await run('rust-warning', 'rust', `fn main(){let unused=1;println!("ok");}`, '', (r) => { assert.equal(r.status, 'success'); assert.match(r.stderr, /warning: unused variable/); });
await run('rust-stdin-streams', 'rust', `use std::io::{self,Read};fn main(){let mut s=String::new();io::stdin().read_to_string(&mut s).unwrap();println!("{}",s.lines().count());eprintln!("rust-error");}`, 'one\ntwo\n', (r) => { assert.equal(r.stdout, '2\n'); assert.equal(r.stderr, 'rust-error\n'); });
await run('rust-panic', 'rust', `fn main(){panic!("test");}`, '', (r) => { assert.equal(r.status, 'runtime_error'); assert.match(r.stderr, /panicked[\s\S]*test/); });
await run('rust-threads', 'rust', `use std::thread;fn main(){let h=thread::spawn(||42);println!("{}",h.join().unwrap());}`, '', (r) => { assert.equal(r.stdout, '42\n'); });
await run('rust-network-denied', 'rust', `use std::net::TcpStream;fn main(){println!("{}",TcpStream::connect("1.1.1.1:80").is_err());}`, '', (r) => { assert.equal(r.status, 'success'); assert.equal(r.stdout, 'true\n'); });
await run('rust-environment', 'rust', `fn main(){println!("{}",std::env::vars().any(|(k,_)|k=="YCODERS_SYNTHETIC_HOST_SECRET"));}`, '', (r) => { assert.equal(r.stdout, 'false\n'); });

await run('go-timeout', 'go', `package main
func main(){for{}}`, '', (r) => { assert.equal(r.status, 'timeout'); });
await run('rust-after-go-timeout', 'rust', `fn main(){println!("recovered");}`, '', (r) => { assert.equal(r.stdout, 'recovered\n'); });
await run('rust-timeout', 'rust', `fn main(){loop{}}`, '', (r) => { assert.equal(r.status, 'timeout'); });
await run('go-after-rust-timeout', 'go', `package main
import "fmt"
func main(){fmt.Println("recovered")}`, '', (r) => { assert.equal(r.stdout, 'recovered\n'); });

console.log(JSON.stringify({ passed: results.length, results }, null, 2));
