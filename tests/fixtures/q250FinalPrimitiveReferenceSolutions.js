const python = `
def getConcatenation(a): return a+a
def longestCommonPrefix(a):
 p=a[0] if a else ''
 for s in a:
  while not s.startswith(p): p=p[:-1]
 return p
def majorityElement(a):
 c=x=0
 for v in a:
  if c==0:x=v
  c+=1 if v==x else -1
 return x
def sortArray(a): return sorted(a)
def maxProfitUnlimited(a): return sum(max(0,b-a) for a,b in zip(a,a[1:]))
def validPalindromeII(s):
 def ok(i,j): return s[i:j+1]==s[i:j+1][::-1]
 i,j=0,len(s)-1
 while i<j and s[i]==s[j]:i+=1;j-=1
 return i>=j or ok(i+1,j) or ok(i,j-1)
def mergeAlternately(a,b): return ''.join((a[i:i+1]+b[i:i+1]) for i in range(max(len(a),len(b))))
def containsNearbyDuplicate(a,k):
 last={}
 for i,x in enumerate(a):
  if x in last and i-last[x]<=k:return True
  last[x]=i
 return False
def searchInsert(a,t):
 l,r=0,len(a)
 while l<r:
  m=(l+r)//2
  if a[m]<t:l=m+1
  else:r=m
 return l
def mySqrt(x):
 l,r=0,x
 while l<=r:
  m=(l+r)//2
  if m*m<=x:l=m+1
  else:r=m-1
 return r
def convertToTitle(n):
 s=''
 while n:n-=1;s=chr(65+n%26)+s;n//=26
 return s
def gcdOfStrings(a,b):
 import math
 return a[:math.gcd(len(a),len(b))] if a+b==b+a else ''
def transpose(a): return [list(x) for x in zip(*a)]
def romanToInt(s):
 m={'I':1,'V':5,'X':10,'L':50,'C':100,'D':500,'M':1000};return sum(-m[x] if i+1<len(s) and m[x]<m[s[i+1]] else m[x] for i,x in enumerate(s))
def addBinary(a,b):
 i,j,c=len(a)-1,len(b)-1,0;r=''
 while i>=0 or j>=0 or c:
  c+=(ord(a[i])-48 if i>=0 else 0)+(ord(b[j])-48 if j>=0 else 0);r=str(c&1)+r;c//=2;i-=1;j-=1
 return r
def rangeBitwiseAnd(a,b):
 n=0
 while a!=b:a>>=1;b>>=1;n+=1
 return a<<n
`;

const javascript = `
function getConcatenation(a){return a.concat(a)}
function longestCommonPrefix(a){let p=a[0]||'';for(const s of a)while(!s.startsWith(p))p=p.slice(0,-1);return p}
function majorityElement(a){let x=0,c=0;for(const v of a){if(!c)x=v;c+=v===x?1:-1}return x}
function sortArray(a){return [...a].sort((x,y)=>x-y)}
function maxProfitUnlimited(a){let r=0;for(let i=1;i<a.length;i++)r+=Math.max(0,a[i]-a[i-1]);return r}
function validPalindromeII(s){const ok=(i,j)=>{while(i<j)if(s[i++]!==s[j--])return false;return true};let i=0,j=s.length-1;while(i<j&&s[i]===s[j]){i++;j--}return i>=j||ok(i+1,j)||ok(i,j-1)}
function mergeAlternately(a,b){let r='';for(let i=0;i<Math.max(a.length,b.length);i++)r+=(a[i]||'')+(b[i]||'');return r}
function containsNearbyDuplicate(a,k){const m=new Map;for(let i=0;i<a.length;i++){if(m.has(a[i])&&i-m.get(a[i])<=k)return true;m.set(a[i],i)}return false}
function searchInsert(a,t){let l=0,r=a.length;while(l<r){const m=(l+r)>>1;if(a[m]<t)l=m+1;else r=m}return l}
function mySqrt(x){let l=0,r=x;while(l<=r){const m=Math.floor((l+r)/2);if(m*m<=x)l=m+1;else r=m-1}return r}
function convertToTitle(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
function gcdOfStrings(a,b){const g=(x,y)=>y?g(y,x%y):x;return a+b===b+a?a.slice(0,g(a.length,b.length)):''}
function transpose(a){return a[0].map((_,i)=>a.map(r=>r[i]))}
function romanToInt(s){const m={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let r=0;for(let i=0;i<s.length;i++)r+=m[s[i]]<(m[s[i+1]]||0)?-m[s[i]]:m[s[i]];return r}
function addBinary(a,b){let i=a.length-1,j=b.length-1,c=0,r='';while(i>=0||j>=0||c){c+=(i>=0?+a[i--]:0)+(j>=0?+b[j--]:0);r=(c&1)+r;c>>=1}return r}
function rangeBitwiseAnd(a,b){let n=0;while(a!==b){a>>>=1;b>>>=1;n++}return a<<n}
`;

const typescript = javascript
  .replace('function getConcatenation(a)', 'function getConcatenation(a:number[]):number[]')
  .replace('function longestCommonPrefix(a)', 'function longestCommonPrefix(a:string[]):string')
  .replace('function majorityElement(a)', 'function majorityElement(a:number[]):number')
  .replace('function sortArray(a)', 'function sortArray(a:number[]):number[]')
  .replace('function maxProfitUnlimited(a)', 'function maxProfitUnlimited(a:number[]):number')
  .replace('function validPalindromeII(s)', 'function validPalindromeII(s:string):boolean')
  .replace('function mergeAlternately(a,b)', 'function mergeAlternately(a:string,b:string):string')
  .replace('function containsNearbyDuplicate(a,k)', 'function containsNearbyDuplicate(a:number[],k:number):boolean')
  .replace('function searchInsert(a,t)', 'function searchInsert(a:number[],t:number):number')
  .replace('function mySqrt(x)', 'function mySqrt(x:number):number')
  .replace('function convertToTitle(n)', 'function convertToTitle(n:number):string')
  .replace('function gcdOfStrings(a,b)', 'function gcdOfStrings(a:string,b:string):string')
  .replace('function transpose(a)', 'function transpose(a:number[][]):number[][]')
  .replace('function romanToInt(s)', 'function romanToInt(s:string):number')
  .replace('function addBinary(a,b)', 'function addBinary(a:string,b:string):string')
  .replace('function rangeBitwiseAnd(a,b)', 'function rangeBitwiseAnd(a:number,b:number):number');

const java = `
import java.util.*; public class Solution{
 public int[] getConcatenation(int[]a){int[]r=new int[a.length*2];System.arraycopy(a,0,r,0,a.length);System.arraycopy(a,0,r,a.length,a.length);return r;}
 public String longestCommonPrefix(String[]a){String p=a.length>0?a[0]:"";for(String s:a)while(!s.startsWith(p))p=p.substring(0,p.length()-1);return p;}
 public int majorityElement(int[]a){int x=0,c=0;for(int v:a){if(c==0)x=v;c+=v==x?1:-1;}return x;}
 public int[] sortArray(int[]a){a=a.clone();Arrays.sort(a);return a;}
 public int maxProfitUnlimited(int[]a){int r=0;for(int i=1;i<a.length;i++)r+=Math.max(0,a[i]-a[i-1]);return r;}
 boolean pal(String s,int i,int j){while(i<j)if(s.charAt(i++)!=s.charAt(j--))return false;return true;} public boolean validPalindromeII(String s){int i=0,j=s.length()-1;while(i<j&&s.charAt(i)==s.charAt(j)){i++;j--;}return i>=j||pal(s,i+1,j)||pal(s,i,j-1);}
 public String mergeAlternately(String a,String b){StringBuilder r=new StringBuilder();for(int i=0;i<Math.max(a.length(),b.length());i++){if(i<a.length())r.append(a.charAt(i));if(i<b.length())r.append(b.charAt(i));}return r.toString();}
 public boolean containsNearbyDuplicate(int[]a,int k){Map<Integer,Integer>m=new HashMap<>();for(int i=0;i<a.length;i++){if(m.containsKey(a[i])&&i-m.get(a[i])<=k)return true;m.put(a[i],i);}return false;}
 public int searchInsert(int[]a,int t){int l=0,r=a.length;while(l<r){int m=(l+r)/2;if(a[m]<t)l=m+1;else r=m;}return l;}
 public int mySqrt(int x){long l=0,r=x;while(l<=r){long m=(l+r)/2;if(m*m<=x)l=m+1;else r=m-1;}return(int)r;}
 public String convertToTitle(int n){StringBuilder s=new StringBuilder();while(n>0){n--;s.append((char)('A'+n%26));n/=26;}return s.reverse().toString();}
 int gcd(int a,int b){return b==0?a:gcd(b,a%b);} public String gcdOfStrings(String a,String b){return(a+b).equals(b+a)?a.substring(0,gcd(a.length(),b.length())):"";}
 public int[][] transpose(int[][]a){int[][]r=new int[a[0].length][a.length];for(int i=0;i<a.length;i++)for(int j=0;j<a[0].length;j++)r[j][i]=a[i][j];return r;}
 public int romanToInt(String s){Map<Character,Integer>m=Map.of('I',1,'V',5,'X',10,'L',50,'C',100,'D',500,'M',1000);int r=0;for(int i=0;i<s.length();i++)r+=m.get(s.charAt(i))<(i+1<s.length()?m.get(s.charAt(i+1)):0)?-m.get(s.charAt(i)):m.get(s.charAt(i));return r;}
 public String addBinary(String a,String b){int i=a.length()-1,j=b.length()-1,c=0;StringBuilder r=new StringBuilder();while(i>=0||j>=0||c>0){c+=(i>=0?a.charAt(i--)-48:0)+(j>=0?b.charAt(j--)-48:0);r.append(c&1);c>>=1;}return r.reverse().toString();}
 public int rangeBitwiseAnd(int a,int b){int n=0;while(a!=b){a>>=1;b>>=1;n++;}return a<<n;}
}`;

const cpp = `
#include <bits/stdc++.h>
using namespace std;
vector<int> getConcatenation(vector<int>a){vector<int>r=a;r.insert(r.end(),a.begin(),a.end());return r;}
string longestCommonPrefix(vector<string>a){string p=a.empty()?"":a[0];for(auto&s:a)while(s.rfind(p,0)!=0)p.pop_back();return p;}
int majorityElement(vector<int>a){int x=0,c=0;for(int v:a){if(!c)x=v;c+=v==x?1:-1;}return x;}
vector<int> sortArray(vector<int>a){sort(a.begin(),a.end());return a;}
int maxProfitUnlimited(vector<int>a){int r=0;for(int i=1;i<a.size();i++)r+=max(0,a[i]-a[i-1]);return r;}
bool pal(string&s,int i,int j){while(i<j)if(s[i++]!=s[j--])return false;return true;} bool validPalindromeII(string s){int i=0,j=s.size()-1;while(i<j&&s[i]==s[j])i++,j--;return i>=j||pal(s,i+1,j)||pal(s,i,j-1);}
string mergeAlternately(string a,string b){string r;for(int i=0;i<max(a.size(),b.size());i++){if(i<a.size())r+=a[i];if(i<b.size())r+=b[i];}return r;}
bool containsNearbyDuplicate(vector<int>a,int k){unordered_map<int,int>m;for(int i=0;i<a.size();i++){if(m.count(a[i])&&i-m[a[i]]<=k)return true;m[a[i]]=i;}return false;}
int searchInsert(vector<int>a,int t){return lower_bound(a.begin(),a.end(),t)-a.begin();}
int mySqrt(int x){long long l=0,r=x;while(l<=r){long long m=(l+r)/2;if(m*m<=x)l=m+1;else r=m-1;}return r;}
string convertToTitle(int n){string s;while(n){n--;s+=char('A'+n%26);n/=26;}reverse(s.begin(),s.end());return s;}
int gcdx(int a,int b){return b?gcdx(b,a%b):a;} string gcdOfStrings(string a,string b){return a+b==b+a?a.substr(0,gcdx(a.size(),b.size())):"";}
vector<vector<int>> transpose(vector<vector<int>>a){vector<vector<int>>r(a[0].size(),vector<int>(a.size()));for(int i=0;i<a.size();i++)for(int j=0;j<a[0].size();j++)r[j][i]=a[i][j];return r;}
int romanToInt(string s){map<char,int>m{{'I',1},{'V',5},{'X',10},{'L',50},{'C',100},{'D',500},{'M',1000}};int r=0;for(int i=0;i<s.size();i++)r+=m[s[i]]<(i+1<s.size()?m[s[i+1]]:0)?-m[s[i]]:m[s[i]];return r;}
string addBinary(string a,string b){int i=a.size()-1,j=b.size()-1,c=0;string r;while(i>=0||j>=0||c){c+=(i>=0?a[i--]-48:0)+(j>=0?b[j--]-48:0);r+=char(48+(c&1));c>>=1;}reverse(r.begin(),r.end());return r;}
int rangeBitwiseAnd(int a,int b){int n=0;while(a!=b)a>>=1,b>>=1,n++;return a<<n;}
`;

const csharp = `
public class Solution{
 public int[] getConcatenation(int[]a){var r=new int[a.Length*2];a.CopyTo(r,0);a.CopyTo(r,a.Length);return r;}
 public string longestCommonPrefix(string[]a){string p=a.Length>0?a[0]:"";foreach(var s in a)while(!s.StartsWith(p))p=p.Substring(0,p.Length-1);return p;}
 public int majorityElement(int[]a){int x=0,c=0;foreach(int v in a){if(c==0)x=v;c+=v==x?1:-1;}return x;}
 public int[] sortArray(int[]a){a=(int[])a.Clone();System.Array.Sort(a);return a;}
 public int maxProfitUnlimited(int[]a){int r=0;for(int i=1;i<a.Length;i++)r+=System.Math.Max(0,a[i]-a[i-1]);return r;}
 bool Pal(string s,int i,int j){while(i<j)if(s[i++]!=s[j--])return false;return true;} public bool validPalindromeII(string s){int i=0,j=s.Length-1;while(i<j&&s[i]==s[j]){i++;j--;}return i>=j||Pal(s,i+1,j)||Pal(s,i,j-1);}
 public string mergeAlternately(string a,string b){var r=new System.Text.StringBuilder();for(int i=0;i<System.Math.Max(a.Length,b.Length);i++){if(i<a.Length)r.Append(a[i]);if(i<b.Length)r.Append(b[i]);}return r.ToString();}
 public bool containsNearbyDuplicate(int[]a,int k){var m=new System.Collections.Generic.Dictionary<int,int>();for(int i=0;i<a.Length;i++){if(m.ContainsKey(a[i])&&i-m[a[i]]<=k)return true;m[a[i]]=i;}return false;}
 public int searchInsert(int[]a,int t){int l=0,r=a.Length;while(l<r){int m=(l+r)/2;if(a[m]<t)l=m+1;else r=m;}return l;}
 public int mySqrt(int x){long l=0,r=x;while(l<=r){long m=(l+r)/2;if(m*m<=x)l=m+1;else r=m-1;}return(int)r;}
 public string convertToTitle(int n){var s=new System.Text.StringBuilder();while(n>0){n--;s.Append((char)('A'+n%26));n/=26;}var a=s.ToString().ToCharArray();System.Array.Reverse(a);return new string(a);}
 int G(int a,int b){return b==0?a:G(b,a%b);} public string gcdOfStrings(string a,string b){return a+b==b+a?a.Substring(0,G(a.Length,b.Length)):"";}
 public int[][] transpose(int[][]a){var r=new int[a[0].Length][];for(int j=0;j<r.Length;j++){r[j]=new int[a.Length];for(int i=0;i<a.Length;i++)r[j][i]=a[i][j];}return r;}
 public int romanToInt(string s){var m=new System.Collections.Generic.Dictionary<char,int>{{'I',1},{'V',5},{'X',10},{'L',50},{'C',100},{'D',500},{'M',1000}};int r=0;for(int i=0;i<s.Length;i++)r+=m[s[i]]<(i+1<s.Length?m[s[i+1]]:0)?-m[s[i]]:m[s[i]];return r;}
 public string addBinary(string a,string b){int i=a.Length-1,j=b.Length-1,c=0;var r=new System.Text.StringBuilder();while(i>=0||j>=0||c>0){c+=(i>=0?a[i--]-48:0)+(j>=0?b[j--]-48:0);r.Append(c&1);c>>=1;}var x=r.ToString().ToCharArray();System.Array.Reverse(x);return new string(x);}
 public int rangeBitwiseAnd(int a,int b){int n=0;while(a!=b){a>>=1;b>>=1;n++;}return a<<n;}
}`;

const php = `<?php
function getConcatenation(array $a):array{return array_merge($a,$a);} function longestCommonPrefix(array $a):string{$p=$a[0]??'';foreach($a as $s)while(strncmp($s,$p,strlen($p))!==0)$p=substr($p,0,-1);return$p;} function majorityElement(array $a):int{$x=$c=0;foreach($a as $v){if(!$c)$x=$v;$c+=$v===$x?1:-1;}return$x;} function sortArray(array $a):array{sort($a);return$a;} function maxProfitUnlimited(array $a):int{$r=0;for($i=1;$i<count($a);$i++)$r+=max(0,$a[$i]-$a[$i-1]);return$r;}
function validPalindromeII(string $s):bool{$ok=function($i,$j)use($s){while($i<$j)if($s[$i++]!==$s[$j--])return false;return true;};$i=0;$j=strlen($s)-1;while($i<$j&&$s[$i]===$s[$j]){$i++;$j--;}return$i>=$j||$ok($i+1,$j)||$ok($i,$j-1);} function mergeAlternately(string $a,string $b):string{$r='';for($i=0;$i<max(strlen($a),strlen($b));$i++)$r.=($a[$i]??'').($b[$i]??'');return$r;} function containsNearbyDuplicate(array $a,int $k):bool{$m=[];foreach($a as $i=>$v){$z=(string)$v;if(array_key_exists($z,$m)&&$i-$m[$z]<=$k)return true;$m[$z]=$i;}return false;} function searchInsert(array $a,int $t):int{$l=0;$r=count($a);while($l<$r){$m=intdiv($l+$r,2);if($a[$m]<$t)$l=$m+1;else$r=$m;}return$l;} function mySqrt(int $x):int{$l=0;$r=$x;while($l<=$r){$m=intdiv($l+$r,2);if($m*$m<=$x)$l=$m+1;else$r=$m-1;}return$r;}
function convertToTitle(int $n):string{$s='';while($n){$n--;$s=chr(65+$n%26).$s;$n=intdiv($n,26);}return$s;} function gcdx($a,$b){return$b?gcdx($b,$a%$b):$a;} function gcdOfStrings(string $a,string $b):string{return$a.$b===$b.$a?substr($a,0,gcdx(strlen($a),strlen($b))):'';} function transpose(array $a):array{$r=[];for($j=0;$j<count($a[0]);$j++){for($i=0;$i<count($a);$i++)$r[$j][]=$a[$i][$j];}return$r;} function romanToInt(string $s):int{$m=['I'=>1,'V'=>5,'X'=>10,'L'=>50,'C'=>100,'D'=>500,'M'=>1000];$r=0;for($i=0;$i<strlen($s);$i++)$r+=$m[$s[$i]]<($m[$s[$i+1]??'']??0)?-$m[$s[$i]]:$m[$s[$i]];return$r;} function addBinary(string $a,string $b):string{$i=strlen($a)-1;$j=strlen($b)-1;$c=0;$r='';while($i>=0||$j>=0||$c){$c+=($i>=0?(int)$a[$i--]:0)+($j>=0?(int)$b[$j--]:0);$r=($c&1).$r;$c>>=1;}return$r;} function rangeBitwiseAnd(int $a,int $b):int{$n=0;while($a!==$b){$a>>=1;$b>>=1;$n++;}return$a<<$n;}`;

const r = `
getConcatenation<-function(a)c(a,a)
longestCommonPrefix<-function(a){p<-if(length(a))a[[1]] else '';for(s in a)while(substr(s,1,nchar(p))!=p)p<-substr(p,1,nchar(p)-1);p}
majorityElement<-function(a){as.numeric(names(which.max(table(a))))}
sortArray<-function(a)sort(a)
maxProfitUnlimited<-function(a)sum(pmax(0,diff(a)))
validPalindromeII<-function(s){v<-strsplit(s,'')[[1]];ok<-function(x)identical(x,rev(x));for(i in seq_along(v))if(ok(v[-i]))return(TRUE);ok(v)}
mergeAlternately<-function(a,b){x<-strsplit(a,'')[[1]];y<-strsplit(b,'')[[1]];paste0(c(rbind(c(x,rep('',max(0,length(y)-length(x)))),c(y,rep('',max(0,length(x)-length(y)))))),collapse='')}
containsNearbyDuplicate<-function(a,k){if(k<=0)return(FALSE);for(i in seq_along(a))if(i>1&&any(a[max(1,i-k):(i-1)]==a[i]))return(TRUE);FALSE}
searchInsert<-function(a,t)sum(a<t)
mySqrt<-function(x)floor(sqrt(x))
convertToTitle<-function(n){s<-'';while(n>0){n<-n-1;s<-paste0(intToUtf8(65+n%%26),s);n<-n%/%26};s}
gcdOfStrings<-function(a,b){g<-function(x,y)if(y==0)x else Recall(y,x%%y);if(paste0(a,b)!=paste0(b,a))'' else substr(a,1,g(nchar(a),nchar(b)))}
transpose<-function(a)lapply(seq_along(a[[1]]),function(j)vapply(a,function(x)x[[j]],numeric(1)))
romanToInt<-function(s){m<-c(I=1,V=5,X=10,L=50,C=100,D=500,M=1000);x<-unname(m[strsplit(s,'')[[1]]]);y<-c(x[-1],0);sum(ifelse(x<y,-x,x))}
addBinary<-function(a,b){x<-strtoi(a,2);y<-strtoi(b,2);if(x+y==0)'0' else paste(rev(as.integer(intToBits(x+y))[1:max(which(as.integer(intToBits(x+y))==1))]),collapse='')}
rangeBitwiseAnd<-function(a,b){n<-0;while(a!=b){a<-a%/%2;b<-b%/%2;n<-n+1};a*2^n}
`;

const c = `
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
typedef struct{int32_t*data;size_t len;}IntArray;typedef struct{IntArray*data;size_t len;}IntMatrix;typedef struct{unsigned char*data;size_t len;}ByteString;typedef struct{ByteString*data;size_t len;}StringArray;
IntArray ia(size_t n){IntArray r={calloc(n,sizeof(int32_t)),n};return r;} ByteString bs(size_t n){ByteString r={calloc(n+1,1),n};return r;}
IntArray getConcatenation(IntArray a){IntArray r=ia(a.len*2);memcpy(r.data,a.data,a.len*4);memcpy(r.data+a.len,a.data,a.len*4);return r;}
ByteString longestCommonPrefix(StringArray a){size_t n=a.len?a.data[0].len:0;for(size_t i=1;i<a.len;i++){size_t j=0;while(j<n&&j<a.data[i].len&&a.data[0].data[j]==a.data[i].data[j])j++;n=j;}ByteString r=bs(n);memcpy(r.data,a.data[0].data,n);return r;}
int32_t majorityElement(IntArray a){int x=0,c=0;for(size_t i=0;i<a.len;i++){if(!c)x=a.data[i];c+=a.data[i]==x?1:-1;}return x;} int cmp(const void*x,const void*y){int a=*(int*)x,b=*(int*)y;return(a>b)-(a<b);} IntArray sortArray(IntArray a){IntArray r=ia(a.len);memcpy(r.data,a.data,a.len*4);qsort(r.data,r.len,4,cmp);return r;} int32_t maxProfitUnlimited(IntArray a){int r=0;for(size_t i=1;i<a.len;i++)if(a.data[i]>a.data[i-1])r+=a.data[i]-a.data[i-1];return r;}
bool palp(ByteString s,size_t i,size_t j){while(i<j)if(s.data[i++]!=s.data[j--])return false;return true;} bool validPalindromeII(ByteString s){size_t i=0,j=s.len-1;while(i<j&&s.data[i]==s.data[j])i++,j--;return i>=j||palp(s,i+1,j)||palp(s,i,j-1);} ByteString mergeAlternately(ByteString a,ByteString b){ByteString r=bs(a.len+b.len);size_t p=0,n=a.len>b.len?a.len:b.len;for(size_t i=0;i<n;i++){if(i<a.len)r.data[p++]=a.data[i];if(i<b.len)r.data[p++]=b.data[i];}return r;}
bool containsNearbyDuplicate(IntArray a,int32_t k){for(size_t i=0;i<a.len;i++)for(size_t j=i+1;j<a.len&&j-i<=(size_t)k;j++)if(a.data[i]==a.data[j])return true;return false;} int32_t searchInsert(IntArray a,int32_t t){size_t l=0,r=a.len;while(l<r){size_t m=(l+r)/2;if(a.data[m]<t)l=m+1;else r=m;}return l;} int32_t mySqrt(int32_t x){int64_t l=0,r=x;while(l<=r){int64_t m=(l+r)/2;if(m*m<=x)l=m+1;else r=m-1;}return r;}
ByteString convertToTitle(int32_t n){unsigned char z[16];size_t p=16;while(n){n--;z[--p]='A'+n%26;n/=26;}ByteString r=bs(16-p);memcpy(r.data,z+p,r.len);return r;} int gd(int a,int b){return b?gd(b,a%b):a;} ByteString gcdOfStrings(ByteString a,ByteString b){size_t n=a.len+b.len;for(size_t i=0;i<n;i++)if((i<a.len?a.data[i]:b.data[i-a.len])!=(i<b.len?b.data[i]:a.data[i-b.len]))return bs(0);size_t z=gd(a.len,b.len);ByteString r=bs(z);memcpy(r.data,a.data,z);return r;} IntMatrix transpose(IntMatrix a){IntMatrix r={calloc(a.data[0].len,sizeof(IntArray)),a.data[0].len};for(size_t j=0;j<r.len;j++){r.data[j]=ia(a.len);for(size_t i=0;i<a.len;i++)r.data[j].data[i]=a.data[i].data[j];}return r;}
int rv(unsigned char c){return c=='I'?1:c=='V'?5:c=='X'?10:c=='L'?50:c=='C'?100:c=='D'?500:1000;} int32_t romanToInt(ByteString s){int r=0;for(size_t i=0;i<s.len;i++){int v=rv(s.data[i]);r+=i+1<s.len&&v<rv(s.data[i+1])?-v:v;}return r;} ByteString addBinary(ByteString a,ByteString b){size_t n=(a.len>b.len?a.len:b.len)+1,p=n;ByteString r=bs(n);int c=0;size_t i=a.len,j=b.len;while(i||j||c){c+=(i?a.data[--i]-48:0)+(j?b.data[--j]-48:0);r.data[--p]='0'+(c&1);c>>=1;}memmove(r.data,r.data+p,n-p);r.len=n-p;return r;} int32_t rangeBitwiseAnd(int32_t a,int32_t b){int n=0;while(a!=b)a>>=1,b>>=1,n++;return a<<n;}
`;

export const Q250_FINAL_PRIMITIVE_SHARED = Object.freeze({ python, java, javascript, typescript, c, cpp, csharp, php, r });
const ids = ['NC250-151','NC250-152','NC250-154','NC250-157','NC250-160','NC250-165','NC250-166','NC250-172','NC250-183','NC250-185','NC250-243','NC250-244','NC250-246','NC250-247','NC250-248','NC250-249'];
export const Q250_FINAL_PRIMITIVE_REFERENCE_SOLUTIONS = Object.freeze(Object.fromEntries(ids.map((id) => [id, Q250_FINAL_PRIMITIVE_SHARED])));
