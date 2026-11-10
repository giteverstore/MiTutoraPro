const sources = Object.freeze({
  python: `
def calPoints(a):
 s=[]
 for x in a:
  if x=='C':s.pop()
  elif x=='D':s.append(2*s[-1])
  elif x=='+':s.append(s[-1]+s[-2])
  else:s.append(int(x))
 return str(sum(s))
def asteroidCollision(a):
 s=[]
 for x in a:
  while s and x<0<s[-1]:
   if s[-1]<-x:s.pop();continue
   if s[-1]==-x:s.pop()
   break
  else:s.append(x)
 return s
def simplifyPath(p):
 s=[]
 for x in p.split('/'):
  if x=='..':
   if s:s.pop()
  elif x and x!='.':s.append(x)
 return '/'+ '/'.join(s)
def decodeString(s):
 nums=[];parts=[];cur='';n=0
 for c in s:
  if c.isdigit():n=n*10+int(c)
  elif c=='[':nums.append(n);parts.append(cur);n=0;cur=''
  elif c==']':cur=parts.pop()+cur*nums.pop()
  else:cur+=c
 return cur`,
  javascript: `function calPoints(a){const s=[];for(const x of a)if(x==='C')s.pop();else if(x==='D')s.push(2*s.at(-1));else if(x==='+')s.push(s.at(-1)+s.at(-2));else s.push(+x);return String(s.reduce((x,y)=>x+y,0))}
function asteroidCollision(a){const s=[];for(let x of a){let alive=true;while(alive&&x<0&&s.at(-1)>0){if(s.at(-1)<-x){s.pop();continue}if(s.at(-1)===-x)s.pop();alive=false}if(alive)s.push(x)}return s}
function simplifyPath(p){const s=[];for(const x of p.split('/'))if(x==='..')s.pop();else if(x&&x!=='.')s.push(x);return'/'+s.join('/')}
function decodeString(s){const ns=[],ps=[];let cur='',n=0;for(const c of s)if(c>='0'&&c<='9')n=n*10+(+c);else if(c==='['){ns.push(n);ps.push(cur);n=0;cur=''}else if(c===']')cur=ps.pop()+cur.repeat(ns.pop());else cur+=c;return cur}`,
  typescript: `function calPoints(a:string[]):string{const s:number[]=[];for(const x of a)if(x==='C')s.pop();else if(x==='D')s.push(2*s[s.length-1]);else if(x==='+')s.push(s[s.length-1]+s[s.length-2]);else s.push(+x);return String(s.reduce((x,y)=>x+y,0))}
function asteroidCollision(a:number[]):number[]{const s:number[]=[];for(let x of a){let alive=true;while(alive&&x<0&&(s[s.length-1]??-1)>0){if(s[s.length-1]<-x){s.pop();continue}if(s[s.length-1]===-x)s.pop();alive=false}if(alive)s.push(x)}return s}
function simplifyPath(p:string):string{const s:string[]=[];for(const x of p.split('/'))if(x==='..')s.pop();else if(x&&x!=='.')s.push(x);return'/'+s.join('/')}
function decodeString(s:string):string{const ns:number[]=[],ps:string[]=[];let cur='',n=0;for(const c of s)if(c>='0'&&c<='9')n=n*10+(+c);else if(c==='['){ns.push(n);ps.push(cur);n=0;cur=''}else if(c===']')cur=ps.pop()!+cur.repeat(ns.pop()!);else cur+=c;return cur}`,
  java: `import java.util.*;public class Solution{public String calPoints(String[]a){ArrayList<Integer>s=new ArrayList<>();for(String x:a)if(x.equals("C"))s.remove(s.size()-1);else if(x.equals("D"))s.add(2*s.get(s.size()-1));else if(x.equals("+"))s.add(s.get(s.size()-1)+s.get(s.size()-2));else s.add(Integer.parseInt(x));long r=0;for(int x:s)r+=x;return Long.toString(r);}public int[] asteroidCollision(int[]a){ArrayList<Integer>s=new ArrayList<>();for(int x:a){boolean z=true;while(z&&x<0&&!s.isEmpty()&&s.get(s.size()-1)>0){int y=s.get(s.size()-1);if(y< -x){s.remove(s.size()-1);continue;}if(y== -x)s.remove(s.size()-1);z=false;}if(z)s.add(x);}return s.stream().mapToInt(x->x).toArray();}public String simplifyPath(String p){ArrayDeque<String>s=new ArrayDeque<>();for(String x:p.split("/"))if(x.equals("..")){if(!s.isEmpty())s.removeLast();}else if(!x.isEmpty()&&!x.equals("."))s.addLast(x);return"/"+String.join("/",s);}public String decodeString(String s){ArrayDeque<Integer>ns=new ArrayDeque<>();ArrayDeque<String>ps=new ArrayDeque<>();String cur="";int n=0;for(char c:s.toCharArray())if(Character.isDigit(c))n=n*10+c-'0';else if(c=='['){ns.push(n);ps.push(cur);n=0;cur="";}else if(c==']')cur=ps.pop()+cur.repeat(ns.pop());else cur+=c;return cur;}}`,
  cpp: `#include <bits/stdc++.h>
using namespace std;string calPoints(vector<string>a){vector<long long>s;for(auto x:a)if(x=="C")s.pop_back();else if(x=="D")s.push_back(2*s.back());else if(x=="+")s.push_back(s.back()+s[s.size()-2]);else s.push_back(stoll(x));return to_string(accumulate(s.begin(),s.end(),0LL));}vector<int> asteroidCollision(vector<int>a){vector<int>s;for(int x:a){bool z=true;while(z&&x<0&&!s.empty()&&s.back()>0){if(s.back()<-x){s.pop_back();continue;}if(s.back()==-x)s.pop_back();z=false;}if(z)s.push_back(x);}return s;}string simplifyPath(string p){vector<string>s;stringstream q(p);string x;while(getline(q,x,'/'))if(x==".."){if(!s.empty())s.pop_back();}else if(!x.empty()&&x!=".")s.push_back(x);string r;for(auto&v:s)r+="/"+v;return r.empty()?"/":r;}string decodeString(string s){vector<int>ns;vector<string>ps;string cur;int n=0;for(char c:s)if(isdigit(c))n=n*10+c-'0';else if(c=='['){ns.push_back(n);ps.push_back(cur);n=0;cur="";}else if(c==']'){string t;while(ns.back()--)t+=cur;ns.pop_back();cur=ps.back()+t;ps.pop_back();}else cur+=c;return cur;}`,
  csharp: `public class Solution{public string calPoints(string[]a){var s=new System.Collections.Generic.List<long>();foreach(var x in a)if(x=="C")s.RemoveAt(s.Count-1);else if(x=="D")s.Add(2*s[^1]);else if(x=="+")s.Add(s[^1]+s[^2]);else s.Add(long.Parse(x));long r=0;foreach(var x in s)r+=x;return r.ToString();}public int[] asteroidCollision(int[]a){var s=new System.Collections.Generic.List<int>();foreach(int x in a){bool z=true;while(z&&x<0&&s.Count>0&&s[^1]>0){if(s[^1]<-x){s.RemoveAt(s.Count-1);continue;}if(s[^1]==-x)s.RemoveAt(s.Count-1);z=false;}if(z)s.Add(x);}return s.ToArray();}public string simplifyPath(string p){var s=new System.Collections.Generic.List<string>();foreach(var x in p.Split('/'))if(x==".."){if(s.Count>0)s.RemoveAt(s.Count-1);}else if(x!=""&&x!=".")s.Add(x);return"/"+string.Join("/",s);}public string decodeString(string s){var ns=new System.Collections.Generic.Stack<int>();var ps=new System.Collections.Generic.Stack<string>();string cur="";int n=0;foreach(char c in s)if(char.IsDigit(c))n=n*10+c-'0';else if(c=='['){ns.Push(n);ps.Push(cur);n=0;cur="";}else if(c==']'){string t="";int k=ns.Pop();while(k-->0)t+=cur;cur=ps.Pop()+t;}else cur+=c;return cur;}}`,
  php: `<?php function calPoints(array $a):string{$s=[];foreach($a as $x)if($x==='C')array_pop($s);elseif($x==='D')$s[]=2*end($s);elseif($x==='+')$s[]=$s[count($s)-1]+$s[count($s)-2];else$s[]=(int)$x;return(string)array_sum($s);}function asteroidCollision(array $a):array{$s=[];foreach($a as $x){$z=true;while($z&&$x<0&&$s&&end($s)>0){if(end($s)<-$x){array_pop($s);continue;}if(end($s)==-$x)array_pop($s);$z=false;}if($z)$s[]=$x;}return$s;}function simplifyPath(string $p):string{$s=[];foreach(explode('/',$p)as$x)if($x==='..')array_pop($s);elseif($x!==''&&$x!=='.')$s[]=$x;return'/'.implode('/',$s);}function decodeString(string $s):string{$ns=$ps=[];$cur='';$n=0;for($i=0;$i<strlen($s);$i++){$c=$s[$i];if(ctype_digit($c))$n=$n*10+(int)$c;elseif($c==='['){$ns[]=$n;$ps[]=$cur;$n=0;$cur='';}elseif($c===']')$cur=array_pop($ps).str_repeat($cur,array_pop($ns));else$cur.=$c;}return$cur;}`,
  r: `calPoints<-function(a){s<-c();for(x in a)if(x=='C')s<-head(s,-1)else if(x=='D')s<-c(s,2*tail(s,1))else if(x=='+')s<-c(s,sum(tail(s,2)))else s<-c(s,as.numeric(x));as.character(sum(s))}
asteroidCollision<-function(a){s<-c();for(x in a){z<-TRUE;while(z&&x<0&&length(s)&&tail(s,1)>0){if(tail(s,1) < -x){s<-head(s,-1);next};if(tail(s,1)== -x)s<-head(s,-1);z<-FALSE};if(z)s<-c(s,x)};s}
simplifyPath<-function(p){s<-c();for(x in strsplit(p,'/',fixed=TRUE)[[1]])if(x=='..')s<-head(s,-1)else if(x!=''&&x!='.')s<-c(s,x);paste0('/',paste(s,collapse='/'))}
decodeString<-function(s){cs<-strsplit(s,'')[[1]];ns<-c();ps<-c();cur<-'';n<-0;for(ch in cs)if(grepl('[0-9]',ch)){n<-n*10+as.numeric(ch)}else if(ch=='['){ns<-c(ns,n);ps<-c(ps,cur);n<-0;cur<-''}else if(ch==']'){cur<-paste0(tail(ps,1),paste(rep(cur,tail(ns,1)),collapse=''));ps<-head(ps,-1);ns<-head(ns,-1)}else cur<-paste0(cur,ch);cur}`,
  c: `#include <stdbool.h>\n#include <stddef.h>\n#include <stdint.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\ntypedef struct{int32_t*data;size_t len;}IntArray;typedef struct{unsigned char*data;size_t len;}ByteString;typedef struct{ByteString*data;size_t len;}StringArray;ByteString out(const char*s){size_t n=strlen(s);ByteString r={calloc(n+1,1),n};memcpy(r.data,s,n);return r;}ByteString calPoints(StringArray a){long long*s=calloc(a.len,8);size_t n=0;for(size_t i=0;i<a.len;i++){char*x=(char*)a.data[i].data;if(!strcmp(x,"C"))n--;else if(!strcmp(x,"D"))s[n++]=2*s[n-1];else if(!strcmp(x,"+"))s[n++]=s[n-1]+s[n-2];else s[n++]=strtoll(x,0,10);}long long z=0;for(size_t i=0;i<n;i++)z+=s[i];char b[32];sprintf(b,"%lld",z);return out(b);}IntArray asteroidCollision(IntArray a){IntArray r={calloc(a.len,4),0};for(size_t i=0;i<a.len;i++){int x=a.data[i];bool z=true;while(z&&x<0&&r.len&&r.data[r.len-1]>0){if(r.data[r.len-1]<-x){r.len--;continue;}if(r.data[r.len-1]==-x)r.len--;z=false;}if(z)r.data[r.len++]=x;}return r;}ByteString simplifyPath(ByteString p){char*b=calloc(p.len+2,1);size_t cuts[256],n=0,o=0,i=0;while(i<p.len){while(i<p.len&&p.data[i]=='/')i++;size_t j=i;while(j<p.len&&p.data[j]!='/')j++;size_t z=j-i;if(z==2&&!memcmp(p.data+i,"..",2)){if(n)o=cuts[--n];}else if(z&&!(z==1&&p.data[i]=='.')){cuts[n++]=o;b[o++]='/';memcpy(b+o,p.data+i,z);o+=z;}i=j;}if(!o)b[o++]='/';ByteString r={(unsigned char*)b,o};return r;}ByteString decodeString(ByteString s){char*stack=calloc(10000,1);int nums[1000],starts[1000],top=0,n=0,o=0;for(size_t i=0;i<s.len;i++){char c=s.data[i];if(c>='0'&&c<='9')n=n*10+c-'0';else if(c=='['){nums[top]=n;starts[top++]=o;n=0;}else if(c==']'){int start=starts[--top],len=o-start,k=nums[top];char*t=malloc(len);memcpy(t,stack+start,len);for(int q=1;q<k;q++){memcpy(stack+o,t,len);o+=len;}free(t);}else stack[o++]=c;}ByteString r={(unsigned char*)stack,o};return r;}`,
});
export const Q250_FINAL_STACK_REFERENCE_SOLUTIONS=Object.freeze(Object.fromEntries(['NC250-175','NC250-178','NC250-180','NC250-181'].map(id=>[id,sources])));
