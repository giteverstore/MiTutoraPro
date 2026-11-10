"""Build test-only nine-language references for the controlled Mode B batch."""
import json
import os
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(root))
from render import LANGS  # noqa: E402
from polyglot import generate  # noqa: E402
from validate_languages import SPECS  # noqa: E402

selected = {
    "BLIND150-007": "productExceptSelf", "BLIND150-013": "maxArea", "BLIND150-014": "trap",
    "BLIND150-020": "maxSlidingWindow", "BLIND150-024": "dailyTemperatures", "BLIND150-025": "carFleet",
    "BLIND150-026": "largestRectangleArea", "BLIND150-029": "minEatingSpeed", "BLIND150-030": "findMin",
    "BLIND150-061": "lastStoneWeight", "BLIND150-100": "minCostClimbingStairs", "BLIND150-101": "rob",
    "BLIND150-102": "robCircular", "BLIND150-106": "coinChange", "BLIND150-107": "maxProduct",
    "BLIND150-109": "lengthOfLIS", "BLIND150-110": "canPartition", "BLIND150-122": "maxSubArray",
    "BLIND150-124": "jump", "BLIND150-140": "plusOne",
}

def before(text, marker, suffix=""):
    return text[:text.index(marker)].rstrip() + suffix

sources = {}
sources["c"] = before(generate.c_family(SPECS, False, LANGS["c"][1]), "int main(void)")
sources["cpp"] = before(generate.c_family(SPECS, True, LANGS["cpp"][1]), "int main(void)")
sources["java"] = before(generate.managed(SPECS, False, LANGS["java"][1]), "public static void main", "\n}")
sources["csharp"] = before(generate.managed(SPECS, True, LANGS["csharp"][1]), "public static void Main", "\n}")
sources["javascript"] = before(generate.javascript(SPECS), "const inputs =")
sources["typescript"] = before(generate.javascript(SPECS, LANGS["typescript"][1]), "const inputs =")
sources["javascript"] = "\n".join(line for line in sources["javascript"].splitlines() if "readInput = require" not in line)
sources["typescript"] = "\n".join(line for line in sources["typescript"].splitlines() if "readInput = require" not in line and not line.startswith("declare function require"))
sources["php"] = before(generate.php(SPECS), "$input =")
sources["r"] = before(generate.r_runner(SPECS), "question <-")

sources["java"] = r'''import java.util.*;
public class Solution {
 public int[] productExceptSelf(int[]a){int[]r=new int[a.length];int p=1;for(int i=0;i<a.length;i++){r[i]=p;p*=a[i];}p=1;for(int i=a.length-1;i>=0;i--){r[i]*=p;p*=a[i];}return r;}
 public int maxArea(int[]a){int l=0,r=a.length-1,b=0;while(l<r){b=Math.max(b,(r-l)*Math.min(a[l],a[r]));if(a[l]<a[r])l++;else r--;}return b;}
 public int trap(int[]a){int l=0,r=a.length-1,x=0,y=0,s=0;while(l<=r)if(x<=y){x=Math.max(x,a[l]);s+=x-a[l++];}else{y=Math.max(y,a[r]);s+=y-a[r--];}return s;}
 public int[] maxSlidingWindow(int[]a,int k){int[]q=new int[a.length],o=new int[a.length-k+1];int h=0,t=0;for(int i=0;i<a.length;i++){while(h<t&&q[h]<=i-k)h++;while(h<t&&a[q[t-1]]<=a[i])t--;q[t++]=i;if(i>=k-1)o[i-k+1]=a[q[h]];}return o;}
 public int[] dailyTemperatures(int[]a){int[]r=new int[a.length],s=new int[a.length];int n=0;for(int i=0;i<a.length;i++){while(n>0&&a[s[n-1]]<a[i]){int j=s[--n];r[j]=i-j;}s[n++]=i;}return r;}
 public int carFleet(int target,int[]p,int[]v){Integer[]ix=new Integer[p.length];for(int i=0;i<p.length;i++)ix[i]=i;Arrays.sort(ix,(i,j)->Integer.compare(p[j],p[i]));double last=-1;int n=0;for(int i:ix){double t=(double)(target-p[i])/v[i];if(t>last){last=t;n++;}}return n;}
 public int largestRectangleArea(int[]a){int[]s=new int[a.length+1];int n=0,b=0;for(int i=0;i<=a.length;i++){int x=i<a.length?a[i]:0;while(n>0&&a[s[n-1]]>x){int j=s[--n],l=n>0?s[n-1]:-1;b=Math.max(b,(i-l-1)*a[j]);}s[n++]=i;}return b;}
 public int minEatingSpeed(int[]a,int h){int l=1,r=1;for(int x:a)r=Math.max(r,x);while(l<r){int m=(l+r)/2;long z=0;for(int x:a)z+=(x-1)/m+1;if(z>h)l=m+1;else r=m;}return l;}
 public int findMin(int[]a){int l=0,r=a.length-1;while(l<r){int m=(l+r)/2;if(a[m]>a[r])l=m+1;else r=m;}return a[l];}
 public int lastStoneWeight(int[]a){PriorityQueue<Integer>q=new PriorityQueue<>(Collections.reverseOrder());for(int x:a)q.add(x);while(q.size()>1){int x=q.remove(),y=q.remove();if(x!=y)q.add(x-y);}return q.isEmpty()?0:q.remove();}
 public int minCostClimbingStairs(int[]a){int p=0,c=0;for(int i=1;i<a.length;i++){int n=Math.min(p+a[i-1],c+a[i]);p=c;c=n;}return c;}
 static int rr(int[]a,int l,int r){int p=0,c=0;for(int i=l;i<r;i++){int n=Math.max(c,p+a[i]);p=c;c=n;}return c;}
 public int rob(int[]a){return rr(a,0,a.length);} public int robCircular(int[]a){return a.length==1?a[0]:Math.max(rr(a,0,a.length-1),rr(a,1,a.length));}
 public int coinChange(int[]c,int n){int[]d=new int[n+1];Arrays.fill(d,n+1);d[0]=0;for(int i=1;i<=n;i++)for(int x:c)if(x<=i)d[i]=Math.min(d[i],d[i-x]+1);return d[n]>n?-1:d[n];}
 public int maxProduct(int[]a){int hi=a[0],lo=a[0],b=a[0];for(int i=1;i<a.length;i++){int x=a[i],u=x*hi,v=x*lo;hi=Math.max(x,Math.max(u,v));lo=Math.min(x,Math.min(u,v));b=Math.max(b,hi);}return b;}
 public int lengthOfLIS(int[]a){int[]t=new int[a.length];int n=0;for(int x:a){int l=0,r=n;while(l<r){int m=(l+r)/2;if(t[m]<x)l=m+1;else r=m;}t[l]=x;if(l==n)n++;}return n;}
 public boolean canPartition(int[]a){int s=0;for(int x:a)s+=x;if((s&1)>0)return false;s/=2;boolean[]d=new boolean[s+1];d[0]=true;for(int x:a)for(int j=s;j>=x;j--)d[j]|=d[j-x];return d[s];}
 public int maxSubArray(int[]a){int b=a[0],e=0;for(int x:a){e=Math.max(x,e+x);b=Math.max(b,e);}return b;}
 public int jump(int[]a){int e=0,r=0,n=0;for(int i=0;i<a.length-1;i++){r=Math.max(r,i+a[i]);if(i==e){e=r;n++;}}return n;}
 public int[] plusOne(int[]a){int[]r=a.clone();for(int i=r.length-1;i>=0;i--){if(r[i]<9){r[i]++;return r;}r[i]=0;}int[]z=new int[r.length+1];z[0]=1;return z;}
}'''

python_files = [
    "arrays_reference.py", "windows_reference.py", "stack_reference.py", "binary_reference.py",
    "heap_reference.py", "dp_reference.py", "dp2_reference.py", "greedy_reference.py", "final_reference.py",
]
python = "\n".join((root / name).read_text(encoding="utf-8") for name in python_files)
python = python.replace("from graph_reference import neighbors\n", "")
python += """
productExceptSelf=product_except_self
maxArea=area
trap=rain
maxSlidingWindow=window_max
dailyTemperatures=temperatures
carFleet=fleet
largestRectangleArea=rectangle
minEatingSpeed=eating_speed
findMin=minimum
lastStoneWeight=last_stone
"""
sources["python"] = python

payload = "const SHARED = Object.freeze(" + json.dumps(sources, ensure_ascii=False) + ");\n\n"
payload += "export const Q250_FLAT_ARRAY_BATCH_REFERENCE_SOLUTIONS = Object.freeze({\n"
for question_id in selected:
    payload += f"  {json.dumps(question_id)}: SHARED,\n"
payload += "});\n"

destination = Path(__file__).resolve().parents[1] / "tests/fixtures/q250FlatArrayBatchReferenceSolutions.js"
destination.write_text(payload, encoding="utf-8", newline="\n")
print(destination)
