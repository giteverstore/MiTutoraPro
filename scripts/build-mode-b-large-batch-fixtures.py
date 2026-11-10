"""Build test-only nine-language references for the large safe Mode B batch."""
import json
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(root))
from render import LANGS  # noqa: E402
from polyglot import generate  # noqa: E402
from validate_languages import SPECS  # noqa: E402

IDS = (
    "002", "010", "016", "017", "018", "019", "021", "064", "104",
    "112", "113", "114", "115", "116", "118", "119", "120", "121",
    "126", "128", "129", "144", "145", "146", "147", "148", "149",
    "008", "023", "068", "071", "073", "080", "081", "084", "090", "091", "092", "093", "095", "096",
    "098", "105", "108", "117", "127", "130", "132", "133", "134",
    "135", "137", "139", "142", "150",
)

def before(text, marker, suffix=""):
    return text[:text.index(marker)].rstrip() + suffix

sources = {
    "c": before(generate.c_family(SPECS, False, LANGS["c"][1]), "int main(void)"),
    "cpp": before(generate.c_family(SPECS, True, LANGS["cpp"][1]), "int main(void)"),
    "java": before(generate.managed(SPECS, False, LANGS["java"][1]), "public static void main", "\n}"),
    "csharp": before(generate.managed(SPECS, True, LANGS["csharp"][1]), "public static void Main", "\n}"),
    "javascript": before(generate.javascript(SPECS), "const inputs ="),
    "typescript": before(generate.javascript(SPECS, LANGS["typescript"][1]), "const inputs ="),
    "php": before(generate.php(SPECS), "$input ="),
    "r": before(generate.r_runner(SPECS), "question <-"),
}
sources["javascript"] = "\n".join(
    line for line in sources["javascript"].splitlines() if "readInput = require" not in line
)
sources["typescript"] = "\n".join(
    line for line in sources["typescript"].splitlines()
    if "readInput = require" not in line and not line.startswith("declare function require")
)

# Keep the Java reference browser-friendly. The upstream CLI runner includes
# java.io helpers that make TeaVM pull in unsupported NIO classes even though
# none of these pure functions use I/O.
java = sources["java"].replace("import java.io.*;\n", "")
io_start = java.index("static BufferedReader reader=")
io_end = java.index("static int number", io_start)
java = java[:io_start] + java[io_end:]
java = java.replace("static double read_float(){return Double.parseDouble(line());}\n", "")
java = java.replace("static void write_float(double value){emit(Double.toString(value));}\n", "")
runner_start = java.rindex("static int read_int()")
sources["java"] = java[:runner_start].rstrip() + "\n}"

python_files = (
    "arrays_reference.py", "windows_reference.py", "stack_reference.py",
    "binary_reference.py", "heap_reference.py", "dp_reference.py",
    "dp2_reference.py", "greedy_reference.py", "final_reference.py",
    "backtrack_reference.py", "directed_reference.py", "intervals_reference.py",
    "matrix_reference.py", "advanced_reference.py", "graph_reference.py",
)
python = "\n".join((root / name).read_text(encoding="utf-8") for name in python_files)
python = python.replace("from graph_reference import neighbors\n", "")
python += """
isAnagram=is_anagram
isPalindrome=palindrome
lengthOfLongestSubstring=unique_length
characterReplacement=replace_length
checkInclusion=permutation
minWindow=covering_window
isValid=valid_brackets
leastInterval=least_interval
isValidSudoku=is_valid_sudoku
evalRPN=rpn
combinationSum=lambda candidates,target:sum_rows(candidates,target,True)
subsetsWithDup=lambda nums:subset_rows(nums,True)
exist=word_exists
orangesRotting=rotting
def numIslands(grid):
    rows,cols=len(grid),len(grid[0]); seen=set(); count=0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c]!='1' or (r,c) in seen: continue
            count+=1; seen.add((r,c)); stack=[(r,c)]
            while stack:
                a,b=stack.pop()
                for x,y in ((a-1,b),(a+1,b),(a,b-1),(a,b+1)):
                    if 0<=x<rows and 0<=y<cols and grid[x][y]=='1' and (x,y) not in seen:
                        seen.add((x,y)); stack.append((x,y))
    return count
maxAreaOfIsland=max_area
"""
sources["python"] = python

payload = "const SHARED = Object.freeze(" + json.dumps(sources, ensure_ascii=False) + ");\n\n"
payload += """const SUBSETS_WITH_DUP = Object.freeze({
  ...SHARED,
  python: `${SHARED.python}\\nsubsetsWithDup=lambda nums:subset_rows(nums,True)\\n`,
});
const JAVA_ERASE_OVERLAPS = `public class Solution {
  public int eraseOverlapIntervals(int[][] intervals) {
    for (int i = 1; i < intervals.length; i++) {
      int[] value = intervals[i]; int j = i - 1;
      while (j >= 0 && intervals[j][1] > value[1]) { intervals[j + 1] = intervals[j]; j--; }
      intervals[j + 1] = value;
    }
    int kept = 0, end = Integer.MIN_VALUE;
    for (int[] interval : intervals) if (interval[0] >= end) { kept++; end = interval[1]; }
    return intervals.length - kept;
  }
}`;
const JAVA_MIN_INTERVAL = `public class Solution {
  public int[] minInterval(int[][] intervals, int[] queries) {
    int[] result = new int[queries.length];
    for (int i = 0; i < queries.length; i++) {
      int best = Integer.MAX_VALUE;
      for (int[] interval : intervals) if (interval[0] <= queries[i] && queries[i] <= interval[1])
        best = Math.min(best, interval[1] - interval[0] + 1);
      result[i] = best == Integer.MAX_VALUE ? -1 : best;
    }
    return result;
  }
}`;
const ERASE_OVERLAPS = Object.freeze({ ...SHARED, java: JAVA_ERASE_OVERLAPS });
const MIN_INTERVAL = Object.freeze({ ...SHARED, java: JAVA_MIN_INTERVAL });

"""
payload += "export const Q250_LARGE_MODE_B_REFERENCE_SOLUTIONS = Object.freeze({\n"
for suffix in IDS:
    reference = {"071": "SUBSETS_WITH_DUP", "132": "ERASE_OVERLAPS", "135": "MIN_INTERVAL"}.get(suffix, "SHARED")
    payload += f'  "BLIND150-{suffix}": {reference},\n'
payload += "});\n"

destination = Path(__file__).resolve().parents[1] / "tests/fixtures/q250LargeModeBBatchReferenceSolutions.js"
destination.write_text(payload, encoding="utf-8", newline="\n")
print(destination)
