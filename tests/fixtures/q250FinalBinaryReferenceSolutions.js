const python=`
def cap(a,d,x):
 n=1;s=0
 for v in a:
  if s+v>x:n+=1;s=0
  s+=v
 return n<=d
def shipWithinDays(a,d):
 l,r=max(a),sum(a)
 while l<r:
  m=(l+r)//2
  if cap(a,d,m):r=m
  else:l=m+1
 return l
def searchRotatedII(a,t): return t in a
def splitArray(a,k):
 l,r=max(a),sum(a)
 while l<r:
  m=(l+r)//2
  if cap(a,k,m):r=m
  else:l=m+1
 return l`;
const javascript=`function fit(a,d,x){let n=1,s=0;for(const v of a){if(s+v>x){n++;s=0}s+=v}return n<=d}function shipWithinDays(a,d){let l=Math.max(...a),r=a.reduce((x,y)=>x+y);while(l<r){const m=Math.floor((l+r)/2);if(fit(a,d,m))r=m;else l=m+1}return l}function searchRotatedII(a,t){return a.includes(t)}function splitArray(a,k){let l=Math.max(...a),r=a.reduce((x,y)=>x+y);while(l<r){const m=Math.floor((l+r)/2);if(fit(a,k,m))r=m;else l=m+1}return l}`;
const typescript=`function fit(a:number[],d:number,x:number):boolean{let n=1,s=0;for(const v of a){if(s+v>x){n++;s=0}s+=v}return n<=d}function shipWithinDays(a:number[],d:number):number{let l=Math.max(...a),r=a.reduce((x,y)=>x+y);while(l<r){const m=Math.floor((l+r)/2);if(fit(a,d,m))r=m;else l=m+1}return l}function searchRotatedII(a:number[],t:number):boolean{return a.includes(t)}function splitArray(a:number[],k:number):number{let l=Math.max(...a),r=a.reduce((x,y)=>x+y);while(l<r){const m=Math.floor((l+r)/2);if(fit(a,k,m))r=m;else l=m+1}return l}`;
const java=`public class Solution{boolean fit(int[]a,int d,long x){int n=1;long s=0;for(int v:a){if(s+v>x){n++;s=0;}s+=v;}return n<=d;}int solve(int[]a,int d){long l=0,r=0;for(int v:a){l=Math.max(l,v);r+=v;}while(l<r){long m=(l+r)/2;if(fit(a,d,m))r=m;else l=m+1;}return(int)l;}public int shipWithinDays(int[]a,int d){return solve(a,d);}public boolean searchRotatedII(int[]a,int t){for(int v:a)if(v==t)return true;return false;}public int splitArray(int[]a,int k){return solve(a,k);}}`;
const cpp=`#include <vector>\n#include <algorithm>\n#include <numeric>\nusing namespace std;bool fit(vector<int>a,int d,long long x){int n=1;long long s=0;for(int v:a){if(s+v>x)n++,s=0;s+=v;}return n<=d;}int solve(vector<int>a,int d){long long l=*max_element(a.begin(),a.end()),r=accumulate(a.begin(),a.end(),0LL);while(l<r){long long m=(l+r)/2;if(fit(a,d,m))r=m;else l=m+1;}return l;}int shipWithinDays(vector<int>a,int d){return solve(a,d);}bool searchRotatedII(vector<int>a,int t){return find(a.begin(),a.end(),t)!=a.end();}int splitArray(vector<int>a,int k){return solve(a,k);}`;
const csharp=`public class Solution{bool Fit(int[]a,int d,long x){int n=1;long s=0;foreach(int v in a){if(s+v>x){n++;s=0;}s+=v;}return n<=d;}int Solve(int[]a,int d){long l=0,r=0;foreach(int v in a){l=System.Math.Max(l,v);r+=v;}while(l<r){long m=(l+r)/2;if(Fit(a,d,m))r=m;else l=m+1;}return(int)l;}public int shipWithinDays(int[]a,int d){return Solve(a,d);}public bool searchRotatedII(int[]a,int t){return System.Array.IndexOf(a,t)>=0;}public int splitArray(int[]a,int k){return Solve(a,k);}}`;
const php=`<?php function fit($a,$d,$x){$n=1;$s=0;foreach($a as$v){if($s+$v>$x){$n++;$s=0;}$s+=$v;}return$n<=$d;}function bs($a,$d){$l=max($a);$r=array_sum($a);while($l<$r){$m=intdiv($l+$r,2);if(fit($a,$d,$m))$r=$m;else$l=$m+1;}return$l;}function shipWithinDays(array$a,int$d):int{return bs($a,$d);}function searchRotatedII(array$a,int$t):bool{return in_array($t,$a,true);}function splitArray(array$a,int$k):int{return bs($a,$k);}`;
const r=`fit<-function(a,d,x){n<-1;s<-0;for(v in a){if(s+v>x){n<-n+1;s<-0};s<-s+v};n<=d};solve<-function(a,d){l<-max(a);u<-sum(a);while(l<u){m<-floor((l+u)/2);if(fit(a,d,m))u<-m else l<-m+1};l};shipWithinDays<-function(a,d)solve(a,d);searchRotatedII<-function(a,t)t%in%a;splitArray<-function(a,k)solve(a,k)`;
const c=`#include <stdbool.h>\n#include <stddef.h>\n#include <stdint.h>\ntypedef struct{int32_t*data;size_t len;}IntArray;bool fit(IntArray a,int d,int64_t x){int n=1;int64_t s=0;for(size_t i=0;i<a.len;i++){if(s+a.data[i]>x)n++,s=0;s+=a.data[i];}return n<=d;}int solve(IntArray a,int d){int64_t l=0,r=0;for(size_t i=0;i<a.len;i++){if(a.data[i]>l)l=a.data[i];r+=a.data[i];}while(l<r){int64_t m=(l+r)/2;if(fit(a,d,m))r=m;else l=m+1;}return l;}int32_t shipWithinDays(IntArray a,int32_t d){return solve(a,d);}bool searchRotatedII(IntArray a,int32_t t){for(size_t i=0;i<a.len;i++)if(a.data[i]==t)return true;return false;}int32_t splitArray(IntArray a,int32_t k){return solve(a,k);}`;
const shared=Object.freeze({python,java,javascript,typescript,c,cpp,csharp,php,r});export const Q250_FINAL_BINARY_REFERENCE_SOLUTIONS=Object.freeze(Object.fromEntries(['NC250-186','NC250-187','NC250-188'].map(id=>[id,shared])));
