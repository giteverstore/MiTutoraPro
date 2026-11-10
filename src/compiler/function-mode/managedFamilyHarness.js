import { RESULT_PREFIX } from './containsDuplicateHarness';

const intArray = (values, language) => language === 'java' ? `new int[]{${values.join(',')}}` : `new int[]{${values.join(',')}}`;
const intMatrix = (rows, language) => language === 'java'
  ? `new int[][]{${rows.map((row) => intArray(row, language)).join(',')}}`
  : `new int[][]{${rows.map((row) => intArray(row, language)).join(',')}}`;
const managedLiteral = (value) => typeof value === 'string' ? JSON.stringify(value) : String(value);
const managedArgument = (value, type, language) => {
  if (type === 'integer') return String(Number(value));
  if (type === 'number') return String(Number(value));
  if (type === 'number-array') return `new double[]{${value.map((entry) => Number(entry)).join(',')}}`;
  if (type === 'integer-array') return intArray(value, language);
  if (type === 'integer-matrix') return intMatrix(value, language);
  const stringType = language === 'java' ? 'String' : 'string';
  if (type === 'string-array') return `new ${stringType}[]{${value.map(managedLiteral).join(',')}}`;
  if (type === 'string-matrix') return `new ${stringType}[][]{${value.map((row) => `new ${stringType}[]{${row.map(managedLiteral).join(',')}}`).join(',')}}`;
  return managedLiteral(value);
};
const callableIndexes = (contract) => contract.callableArgumentIndexes ?? contract.arguments.map(({ index }) => index);

function managedStatefulBody(contract, a, language) {
  const model = contract.stateful;
  if (!model) throw new Error('Stateful adapter requires declarative operation metadata.');
  const ctor = model.constructorArgumentIndexes.map((index) => managedArgument(a[index], contract.arguments[index].type, language)).join(',');
  if (model.scalarOperation) {
    const operation = model.scalarOperation;
    const values = intArray(a[model.operationArgumentIndex], language);
    const objectType = language === 'java' ? 'Object' : 'object';
    const listType = language === 'java' ? `java.util.ArrayList<${objectType}>` : `System.Collections.Generic.List<${objectType}>`;
    const add = language === 'java' ? 'add' : 'Add';
    const call = `s.${operation.method}(item)`;
    const result = operation.resultType === 'boolean-integer' ? `(${call}?1:0)` : call;
    return `int[] ops=${values};${model.className} s=new ${model.className}(${ctor});${listType} value=new ${listType}();${language === 'java' ? 'for(int item:ops)' : 'foreach(var item in ops)'}{${operation.collect ? `value.${add}(${result});` : `${call};`}}`;
  }
  const objectType = language === 'java' ? 'Object' : 'object';
  const listType = language === 'java' ? `java.util.ArrayList<${objectType}>` : `System.Collections.Generic.List<${objectType}>`;
  const add = language === 'java' ? 'add' : 'Add';
  const calls = a[model.operationArgumentIndex].map((row) => {
    const operation = model.operations[String(row[0])];
    if (!operation) throw new Error(`Unknown stateful operation ${row[0]}.`);
    const args = operation.argumentIndexes.map((at, index) => {
      const type = operation.argumentTypes[index] ?? (Array.isArray(at) ? 'integer-array' : 'integer');
      const value = Array.isArray(at) ? at.map((position) => Number(row[position])) : row[at];
      return managedArgument(value, type, language);
    }).join(',');
    const call = `s.${operation.method}(${args})`;
    const result = operation.resultType === 'boolean-integer' ? `(${call}?1:0)` : call;
    return operation.collect ? `value.${add}(${result});` : `${call};`;
  }).join('');
  return `${model.className} s=new ${model.className}(${ctor});${listType} value=new ${listType}();${calls}`;
}

function javaLinkedListBody(contract, a, limit) {
  const declarations = [];
  const names = contract.arguments.map(({ type }, i) => {
    if (type === 'linked-list' || type === 'cyclic-linked-list') {
      declarations.push(`Solution.ListNode arg${i}=build(${intArray(a[i], 'java')},${type === 'cyclic-linked-list' ? a[i + 1] : -1});`);
      return `arg${i}`;
    }
    if (type === 'random-linked-list') {
      declarations.push(`Solution.RandomNode arg${i}=buildRandom(${intMatrix(a[i], 'java')});`);
      return `arg${i}`;
    }
    if (type === 'linked-list-array') {
      declarations.push(`int[][] raw${i}=${intMatrix(a[i], 'java')};Solution.ListNode[] arg${i}=new Solution.ListNode[raw${i}.length];for(int j=0;j<raw${i}.length;j++)arg${i}[j]=build(raw${i}[j],-1);`);
      return `arg${i}`;
    }
    return managedArgument(a[i], type, 'java');
  });
  const call = `new Solution().${contract.callable.name}(${callableIndexes(contract).map((i) => names[i]).join(',')})`;
  let execute;
  if (contract.resultSource.kind === 'mutated-argument') execute = `${call};Object value=list(${names[contract.resultSource.argumentIndex]},${limit},${JSON.stringify(contract.identityPolicy)});`;
  else if (contract.resultSource.kind === 'return-value') execute = `Object value=${call};`;
  else if (contract.includeRandom) execute = `Object value=randomList(${call},${limit},${JSON.stringify(contract.identityPolicy)});`;
  else execute = `Object value=list(${call},${limit},${JSON.stringify(contract.identityPolicy)});`;
  return declarations.join('') + execute;
}

function csharpLinkedListBody(contract, a, limit) {
  const declarations = [];
  const names = contract.arguments.map(({ type }, i) => {
    if (type === 'linked-list' || type === 'cyclic-linked-list') {
      declarations.push(`Solution.ListNode arg${i}=LinkedHarness.Build(${intArray(a[i], 'csharp')},${type === 'cyclic-linked-list' ? a[i + 1] : -1});`);
      return `arg${i}`;
    }
    if (type === 'random-linked-list') {
      declarations.push(`Solution.RandomNode arg${i}=LinkedHarness.BuildRandom(${intMatrix(a[i], 'csharp')});`);
      return `arg${i}`;
    }
    if (type === 'linked-list-array') {
      declarations.push(`int[][] raw${i}=${intMatrix(a[i], 'csharp')};var arg${i}=new Solution.ListNode[raw${i}.Length];for(int j=0;j<raw${i}.Length;j++)arg${i}[j]=LinkedHarness.Build(raw${i}[j],-1);`);
      return `arg${i}`;
    }
    return managedArgument(a[i], type, 'csharp');
  });
  const call = `new Solution().${contract.callable.name}(${callableIndexes(contract).map((i) => names[i]).join(',')})`;
  let execute;
  if (contract.resultSource.kind === 'mutated-argument') execute = `${call};object value=LinkedHarness.List(${names[contract.resultSource.argumentIndex]},${limit},${JSON.stringify(contract.identityPolicy)});`;
  else if (contract.resultSource.kind === 'return-value') execute = `object value=${call};`;
  else if (contract.includeRandom) execute = `object value=LinkedHarness.RandomList(${call},${limit},${JSON.stringify(contract.identityPolicy)});`;
  else execute = `object value=LinkedHarness.List(${call},${limit},${JSON.stringify(contract.identityPolicy)});`;
  return declarations.join('') + execute;
}

function javaTreeBody(contract, a, limit) {
  const declarations = [];
  const names = contract.arguments.map(({ type }, index) => {
    if (['binary-tree', 'bst', 'tree', 'level-order-tree'].includes(type)) {
      const values = a[index].map((value) => value === null ? 'null' : String(value)).join(',');
      declarations.push(`Integer[] raw${index}=new Integer[]{${values}};Solution.TreeNode[] nodes${index}=new Solution.TreeNode[raw${index}.length];for(int i=0;i<raw${index}.length;i++)if(raw${index}[i]!=null){nodes${index}[i]=new Solution.TreeNode(raw${index}[i]);original.put(nodes${index}[i],true);}java.util.ArrayDeque<Solution.TreeNode> pending${index}=new java.util.ArrayDeque<>();int cursor${index}=1;if(nodes${index}.length>0&&nodes${index}[0]!=null)pending${index}.add(nodes${index}[0]);while(!pending${index}.isEmpty()&&cursor${index}<nodes${index}.length){Solution.TreeNode parent=pending${index}.remove();parent.left=cursor${index}<nodes${index}.length?nodes${index}[cursor${index}++]:null;if(parent.left!=null)pending${index}.add(parent.left);parent.right=cursor${index}<nodes${index}.length?nodes${index}[cursor${index}++]:null;if(parent.right!=null)pending${index}.add(parent.right);}`);
      return `nodes${index}.length==0?null:nodes${index}[0]`;
    }
    if (type === 'tree-node-reference') {
      const selector = contract.nodeReferenceArguments?.[index] ?? {};
      if (selector.selector !== 'value' || selector.requireUnique !== true) throw new Error(`Unsupported Java tree node selector ${index}.`);
      const root = selector.rootArgumentIndex ?? 0;
      return `findNode(nodes${root}.length==0?null:nodes${root}[0],${a[index]})`;
    }
    return managedArgument(a[index], type, 'java');
  });
  const argumentsSource = callableIndexes(contract).map((index) => names[index]).join(',');
  const call = contract.resultSource?.kind === 'codec-round-trip'
    ? `new Solution().${contract.resultSource.decode}(new Solution().${contract.resultSource.encode}(${argumentsSource}))`
    : `new Solution().${contract.callable.name}(${argumentsSource})`;
  const tree = ['level-order-tree', 'returned-tree', 'returned-subtree'].includes(contract.returns.type);
  if (contract.returns.type === 'returned-node') return `${declarations.join('')}Solution.TreeNode result=${call};if(result!=null&&!original.containsKey(result))throw new IllegalStateException("Returned tree node is not an original fixture node");Object value=result==null?null:result.val;`;
  if (contract.resultSource?.kind === 'mutated-argument') return `${declarations.join('')}${call};Object value=tree(${names[contract.resultSource.argumentIndex]},${limit});`;
  return `${declarations.join('')}Object value=${tree ? `tree(${call},${limit})` : call};`;
}

function csharpTreeBody(contract, a, limit) {
  const declarations = [];
  const names = contract.arguments.map(({ type }, index) => {
    if (['binary-tree', 'bst', 'tree', 'level-order-tree'].includes(type)) {
      const values = a[index].map((value) => value === null ? 'null' : String(value)).join(',');
      declarations.push(`int?[] raw${index}=new int?[]{${values}};var nodes${index}=new Solution.TreeNode[raw${index}.Length];for(int i=0;i<raw${index}.Length;i++)if(raw${index}[i].HasValue){nodes${index}[i]=new Solution.TreeNode(raw${index}[i].Value);Original.Add(nodes${index}[i]);}var pending${index}=new System.Collections.Generic.Queue<Solution.TreeNode>();int cursor${index}=1;if(nodes${index}.Length>0&&nodes${index}[0]!=null)pending${index}.Enqueue(nodes${index}[0]);while(pending${index}.Count>0&&cursor${index}<nodes${index}.Length){var parent=pending${index}.Dequeue();parent.left=cursor${index}<nodes${index}.Length?nodes${index}[cursor${index}++]:null;if(parent.left!=null)pending${index}.Enqueue(parent.left);parent.right=cursor${index}<nodes${index}.Length?nodes${index}[cursor${index}++]:null;if(parent.right!=null)pending${index}.Enqueue(parent.right);}`);
      return `nodes${index}.Length==0?null:nodes${index}[0]`;
    }
    if (type === 'tree-node-reference') {
      const selector = contract.nodeReferenceArguments?.[index] ?? {};
      if (selector.selector !== 'value' || selector.requireUnique !== true) throw new Error(`Unsupported C# tree node selector ${index}.`);
      const root = selector.rootArgumentIndex ?? 0;
      return `FindNode(nodes${root}.Length==0?null:nodes${root}[0],${a[index]})`;
    }
    return managedArgument(a[index], type, 'csharp');
  });
  const argumentsSource = callableIndexes(contract).map((index) => names[index]).join(',');
  const call = contract.resultSource?.kind === 'codec-round-trip'
    ? `new Solution().${contract.resultSource.decode}(new Solution().${contract.resultSource.encode}(${argumentsSource}))`
    : `new Solution().${contract.callable.name}(${argumentsSource})`;
  const tree = ['level-order-tree', 'returned-tree', 'returned-subtree'].includes(contract.returns.type);
  if (contract.returns.type === 'returned-node') return `${declarations.join('')}Solution.TreeNode result=${call};if(result!=null&&!IsOriginal(result))throw new System.Exception("Returned tree node is not an original fixture node");object value=result==null?null:(object)result.val;`;
  if (contract.resultSource?.kind === 'mutated-argument') return `${declarations.join('')}${call};object value=Tree(${names[contract.resultSource.argumentIndex]},${limit});`;
  return `${declarations.join('')}object value=${tree ? `Tree(${call},${limit})` : call};`;
}

const csharpLinkedHelpers = `public static class LinkedHarness{static readonly System.Collections.Generic.List<object> O=new System.Collections.Generic.List<object>();public static Solution.ListNode Build(int[]a,int cycle){var n=new Solution.ListNode[a.Length];for(int i=0;i<a.Length;i++){n[i]=new Solution.ListNode(a[i],null);O.Add(n[i]);}for(int i=0;i+1<n.Length;i++)n[i].next=n[i+1];if(n.Length>0&&cycle>=0)n[n.Length-1].next=n[cycle];return n.Length==0?null:n[0];}public static Solution.RandomNode BuildRandom(int[][]a){var n=new Solution.RandomNode[a.Length];for(int i=0;i<a.Length;i++){n[i]=new Solution.RandomNode(a[i][0]);O.Add(n[i]);}for(int i=0;i+1<n.Length;i++)n[i].next=n[i+1];for(int i=0;i<n.Length;i++)n[i].random=a[i][1]<0?null:n[a[i][1]];return n.Length==0?null:n[0];}static bool Original(object x){foreach(var y in O)if(object.ReferenceEquals(x,y))return true;return false;}static void Check(System.Collections.IEnumerable nodes,string p){int count=0,reused=0;foreach(var x in nodes){count++;if(Original(x))reused++;}if(p=="reuse-input-nodes"&&reused!=count)throw new System.Exception("Linked-list output introduced a new node");if((p=="allocate-new-list"||p=="no-original-node-reuse")&&reused>0)throw new System.Exception("Linked-list output illegally reused an input node");}public static object List(Solution.ListNode n,int limit,string p){var v=new System.Collections.Generic.List<int>();var nodes=new System.Collections.Generic.List<Solution.ListNode>();var s=new System.Collections.Generic.HashSet<Solution.ListNode>();while(n!=null&&v.Count<limit){if(!s.Add(n))throw new System.Exception("Cyclic linked-list output");nodes.Add(n);v.Add(n.val);n=n.next;}if(n!=null)throw new System.Exception("Linked-list output exceeded traversal limit");Check(nodes,p);return v;}public static object RandomList(Solution.RandomNode n,int limit,string p){var nodes=new System.Collections.Generic.List<Solution.RandomNode>();var s=new System.Collections.Generic.HashSet<Solution.RandomNode>();while(n!=null&&nodes.Count<limit){if(!s.Add(n))throw new System.Exception("Cyclic linked-list output");nodes.Add(n);n=n.next;}Check(nodes,p);var v=new System.Collections.Generic.List<int[]>();foreach(var x in nodes){int ri=-1;if(x.random!=null){ri=nodes.FindIndex(y=>object.ReferenceEquals(x.random,y));if(ri<0)throw new System.Exception("Random pointer targets an unreachable node");}v.Add(new[]{x.val,ri});}return v;}}`;

function withJavaHelperTypes(source) {
  const helpers = `${/\bListNode\b/.test(source) ? '' : 'public static class ListNode{public int val;public ListNode next;public ListNode(int v,ListNode n){val=v;next=n;}}'}${/\bRandomNode\b/.test(source) ? '' : 'public static class RandomNode{public int val;public RandomNode next,random;public RandomNode(int v){val=v;}}'}${/\bTreeNode\b/.test(source) ? '' : 'public static class TreeNode{public int val;public TreeNode left,right;public TreeNode(int v){val=v;}}'}${/\bGraphNode\b/.test(source) ? '' : 'public static class GraphNode{public int val;public GraphNode[] neighbors;}'}`;
  if (/\bclass\s+Solution\b/.test(source)) return source.slice(0, source.lastIndexOf('}')) + helpers + source.slice(source.lastIndexOf('}'));
  return `class Solution{${helpers}}\n${source}`;
}

function withCSharpHelperTypes(source) {
  const helpers = `${/\bListNode\b/.test(source) ? '' : 'public class ListNode{public int val;public ListNode next;}'}${/\bRandomNode\b/.test(source) ? '' : 'public class RandomNode{public int val;public RandomNode next,random;public RandomNode(int v){val=v;}}'}${/\bTreeNode\b/.test(source) ? '' : 'public class TreeNode{public int val;public TreeNode left,right;}'}${/\bGraphNode\b/.test(source) ? '' : 'public class GraphNode{public int val;public GraphNode[] neighbors;}'}`;
  if (/\bclass\s+Solution\b/.test(source)) return source.slice(0, source.lastIndexOf('}')) + helpers + source.slice(source.lastIndexOf('}'));
  return `public class Solution{${helpers}}\n${source}`;
}

function java(source, contract, fixture) {
  source = withJavaHelperTypes(source);
  const a = fixture.arguments;
  let setup = '';
  let value = '';
  if (['plain-return', 'semantic-collection'].includes(contract.adapter)) {
    const args = a.map((arg, index) => managedArgument(arg, contract.arguments[index].type, 'java')).join(',');
    value = `Object value=new Solution().${contract.callable.name}(${args});`;
  } else if (contract.adapter === 'mutation') {
    const type = (kind) => ({ 'integer-array': 'int[]', 'string-array': 'String[]', 'integer-matrix': 'int[][]' })[kind] ?? 'int';
    setup = contract.arguments.map(({ type: kind }, index) => `${type(kind)} a${index}=${managedArgument(a[index], kind, 'java')};`).join('');
    value = `new Solution().${contract.callable.name}(${contract.arguments.map((_, index) => `a${index}`).join(',')});Object value=a${contract.mutation.target};`;
  } else if (contract.adapter === 'valid-prefix-mutation') {
    setup = contract.arguments.map(({ type: kind }, index) => `${kind === 'integer-array' ? 'int[]' : 'int'} a${index}=${managedArgument(a[index], kind, 'java')};`).join('');
    value = `int k=new Solution().${contract.callable.name}(${contract.arguments.map((_, index) => `a${index}`).join(',')});int safe=k>=0&&k<=a${contract.mutation.target}.length?k:0;int[] value=new int[safe+1];value[0]=k;if(safe>0)System.arraycopy(a${contract.mutation.target},0,value,1,safe);`;
  } else if (contract.adapter === 'linked-list') {
    value = javaLinkedListBody(contract, a, Math.max(32, JSON.stringify(a).length * 4 + 8));
  } else if (contract.adapter === 'tree') {
    value = javaTreeBody(contract, a, Math.max(32, JSON.stringify(a).length * 4 + 8));
  } else if (contract.adapter === 'quad-tree') {
    value = `Solution.QuadNode root=new Solution().${contract.callable.name}(${intMatrix(a[0], 'java')});java.util.ArrayList<Object> value=new java.util.ArrayList<>();java.util.ArrayDeque<Object[]> pending=new java.util.ArrayDeque<>();java.util.IdentityHashMap<Object,Boolean> seen=new java.util.IdentityHashMap<>();if(root!=null)pending.push(new Object[]{root,1,0});while(!pending.isEmpty()){Object[] item=pending.pop();Solution.QuadNode node=(Solution.QuadNode)item[0];int path=(Integer)item[1],depth=(Integer)item[2];if(seen.put(node,true)!=null)throw new IllegalStateException("Cyclic or shared quad-tree output");if(depth>16||seen.size()>${Math.max(32, JSON.stringify(a).length * 4 + 8)})throw new IllegalStateException("Quad-tree output exceeded traversal limit");Solution.QuadNode[] children={node.topLeft,node.topRight,node.bottomLeft,node.bottomRight};if(node.isLeaf){for(Solution.QuadNode child:children)if(child!=null)throw new IllegalStateException("Quad-tree leaf has children");}else for(Solution.QuadNode child:children)if(child==null)throw new IllegalStateException("Quad-tree internal node is malformed");value.add(java.util.Arrays.asList(path,node.isLeaf?1:0,node.val?1:0));if(!node.isLeaf)for(int slot=3;slot>=0;slot--)pending.push(new Object[]{children[slot],path*4+slot,depth+1});}`;
  } else if (contract.adapter === 'graph') {
    setup = `int[][] adj=${intMatrix(a[0], 'java')};Solution.GraphNode[] ns=new Solution.GraphNode[adj.length];for(int i=0;i<adj.length;i++)ns[i]=new Solution.GraphNode(i+1,adj[i].length);for(int i=0;i<adj.length;i++)for(int j=0;j<adj[i].length;j++)ns[i].neighbors[j]=ns[adj[i][j]-1];Solution.GraphNode original=ns.length==0?null:ns[0];Solution.GraphNode root=new Solution().cloneGraph(original);if(original!=null&&root==original)throw new IllegalStateException("Graph result must be a clone");`;
    value = `Object value=graph(root,adj.length,${Math.max(32, a[0].length * 8 + 8)});`;
  } else if (contract.adapter === 'stateful') {
    setup = managedStatefulBody(contract, a, 'java');
    value = '';
  }
  const serializedValue = contract.adapter !== 'stateful' && contract.returns.type === 'string-array'
    ? 'jsonStrings((String[])value)'
    : contract.returns.type === 'string-matrix'
      ? 'jsonStringRows((String[][])value)'
      : contract.returns.type === 'number-array'
        ? 'java.util.Arrays.toString((double[])value)'
      : 'json(value)';
  return `${source}\nclass Main{static final java.util.IdentityHashMap<Object,Boolean> original=new java.util.IdentityHashMap<>();static Solution.TreeNode findNode(Solution.TreeNode root,int value){java.util.ArrayDeque<Solution.TreeNode>q=new java.util.ArrayDeque<>();if(root!=null)q.add(root);Solution.TreeNode found=null;while(!q.isEmpty()){Solution.TreeNode n=q.remove();if(n.val==value){if(found!=null)throw new IllegalStateException("Tree node value selector is ambiguous");found=n;}if(n.left!=null)q.add(n.left);if(n.right!=null)q.add(n.right);}if(found==null)throw new IllegalStateException("Tree node selector did not resolve");return found;}static Solution.ListNode build(int[]a,int cycle){Solution.ListNode[]n=new Solution.ListNode[a.length];for(int i=0;i<a.length;i++){n[i]=new Solution.ListNode(a[i],null);original.put(n[i],true);}for(int i=0;i+1<n.length;i++)n[i].next=n[i+1];if(n.length>0&&cycle>=0)n[n.length-1].next=n[cycle];return n.length==0?null:n[0];}static Solution.RandomNode buildRandom(int[][]a){Solution.RandomNode[]n=new Solution.RandomNode[a.length];for(int i=0;i<a.length;i++){n[i]=new Solution.RandomNode(a[i][0]);original.put(n[i],true);}for(int i=0;i+1<n.length;i++)n[i].next=n[i+1];for(int i=0;i<n.length;i++)n[i].random=a[i][1]<0?null:n[a[i][1]];return n.length==0?null:n[0];}static String quote(String s){StringBuilder b=new StringBuilder("\\\"");for(int i=0;i<s.length();i++){char c=s.charAt(i);if(c=='\\\"'||c=='\\\\')b.append('\\\\').append(c);else if(c=='\\n')b.append("\\\\n");else if(c=='\\r')b.append("\\\\r");else if(c=='\\t')b.append("\\\\t");else if(c<32)b.append(String.format("\\\\u%04x",(int)c));else b.append(c);}return b.append('\\\"').toString();}static String jsonStrings(String[]a){StringBuilder b=new StringBuilder("[");for(String x:a){if(b.length()>1)b.append(',');b.append(quote(x));}return b.append(']').toString();}static String jsonStringRows(String[][]a){StringBuilder b=new StringBuilder("[");for(String[]x:a){if(b.length()>1)b.append(',');b.append(jsonStrings(x));}return b.append(']').toString();}static String json(Object v){if(v==null)return"null";if(v instanceof String)return quote((String)v);if(v instanceof Boolean||v instanceof Number)return v.toString();if(v instanceof int[])return java.util.Arrays.toString((int[])v);if(v instanceof int[][])return java.util.Arrays.deepToString((int[][])v);if(v instanceof java.util.List){StringBuilder b=new StringBuilder("[");for(Object x:(java.util.List<?>)v){if(b.length()>1)b.append(',');b.append(json(x));}return b.append(']').toString();}throw new IllegalStateException("Unsupported serialization");}static void identity(java.util.List<?>n,String policy){int reused=0;for(Object x:n)if(original.containsKey(x))reused++;if(policy.equals("reuse-input-nodes")&&reused!=n.size())throw new IllegalStateException("Linked-list output introduced a new node");if((policy.equals("allocate-new-list")||policy.equals("no-original-node-reuse"))&&reused>0)throw new IllegalStateException("Linked-list output illegally reused an input node");}static java.util.List<Integer> list(Solution.ListNode n,int limit,String policy){java.util.ArrayList<Integer>v=new java.util.ArrayList<>();java.util.ArrayList<Solution.ListNode>nodes=new java.util.ArrayList<>();java.util.IdentityHashMap<Object,Boolean>s=new java.util.IdentityHashMap<>();while(n!=null&&v.size()<limit){if(s.put(n,true)!=null)throw new IllegalStateException("Cyclic linked-list output");nodes.add(n);v.add(n.val);n=n.next;}if(n!=null)throw new IllegalStateException("Linked-list output exceeded traversal limit");identity(nodes,policy);return v;}static java.util.List<Object> randomList(Solution.RandomNode n,int limit,String policy){java.util.ArrayList<Solution.RandomNode>nodes=new java.util.ArrayList<>();java.util.IdentityHashMap<Object,Integer>at=new java.util.IdentityHashMap<>();while(n!=null&&nodes.size()<limit){if(at.put(n,nodes.size())!=null)throw new IllegalStateException("Cyclic linked-list output");nodes.add(n);n=n.next;}identity(nodes,policy);java.util.ArrayList<Object>v=new java.util.ArrayList<>();for(Solution.RandomNode x:nodes){Integer r=x.random==null?-1:at.get(x.random);if(r==null)throw new IllegalStateException("Random pointer targets an unreachable node");v.add(java.util.Arrays.asList(x.val,r));}return v;}static java.util.List<Object> tree(Solution.TreeNode root,int limit){java.util.ArrayList<Object>v=new java.util.ArrayList<>();java.util.LinkedList<Solution.TreeNode>q=new java.util.LinkedList<>();java.util.IdentityHashMap<Object,Boolean>s=new java.util.IdentityHashMap<>();if(root!=null)q.add(root);while(!q.isEmpty()&&v.size()<limit){Solution.TreeNode n=q.remove();if(n==null){v.add(null);continue;}if(s.put(n,true)!=null)throw new IllegalStateException("Cyclic tree output");v.add(n.val);q.add(n.left);q.add(n.right);}while(!v.isEmpty()&&v.get(v.size()-1)==null)v.remove(v.size()-1);if(!q.isEmpty())throw new IllegalStateException("Tree output exceeded traversal limit");return v;}static int[][] graph(Solution.GraphNode root,int size,int limit){int[][]v=new int[size][];java.util.ArrayDeque<Solution.GraphNode>q=new java.util.ArrayDeque<>();java.util.IdentityHashMap<Object,Boolean>s=new java.util.IdentityHashMap<>();if(root!=null)q.add(root);while(!q.isEmpty()&&s.size()<limit){Solution.GraphNode n=q.remove();if(s.put(n,true)!=null)continue;v[n.val-1]=new int[n.neighbors.length];for(int i=0;i<n.neighbors.length;i++){v[n.val-1][i]=n.neighbors[i].val;q.add(n.neighbors[i]);}}if(!q.isEmpty())throw new IllegalStateException("Graph output exceeded traversal limit");return v;}public static void main(String[]x){${setup}${value}System.out.println("${RESULT_PREFIX}"+"{\\\"value\\\":"+${serializedValue}+"}");}}`;
}

function csharp(source, contract, fixture) {
  source = withCSharpHelperTypes(source);
  if (contract.adapter === 'linked-list') source += `\n${csharpLinkedHelpers}`;
  const a = fixture.arguments;
  const arr = (x) => `new int[]{${x.join(',')}}`;
  const matrix = (x) => `new int[][]{${x.map(arr).join(',')}}`;
  let body;
  if (['plain-return', 'semantic-collection'].includes(contract.adapter)) body = `object value=new Solution().${contract.callable.name}(${a.map((x, index) => managedArgument(x, contract.arguments[index].type, 'csharp')).join(',')});`;
  if (contract.adapter === 'mutation') {
    const type = (kind) => ({ 'integer-array': 'int[]', 'string-array': 'string[]', 'integer-matrix': 'int[][]' })[kind] ?? 'int';
    const setup = contract.arguments.map(({ type: kind }, index) => `${type(kind)} a${index}=${managedArgument(a[index], kind, 'csharp')};`).join('');
    body = `${setup}new Solution().${contract.callable.name}(${contract.arguments.map((_, index) => `a${index}`).join(',')});object value=a${contract.mutation.target};`;
  }
  if (contract.adapter === 'valid-prefix-mutation') {
    const setup = contract.arguments.map(({ type: kind }, index) => `${kind === 'integer-array' ? 'int[]' : 'int'} a${index}=${managedArgument(a[index], kind, 'csharp')};`).join('');
    body = `${setup}int k=new Solution().${contract.callable.name}(${contract.arguments.map((_, index) => `a${index}`).join(',')});int safe=k>=0&&k<=a${contract.mutation.target}.Length?k:0;int[] value=new int[safe+1];value[0]=k;if(safe>0)System.Array.Copy(a${contract.mutation.target},0,value,1,safe);`;
  }
  if (contract.adapter === 'linked-list') body = csharpLinkedListBody(contract, a, Math.max(32, JSON.stringify(a).length * 4 + 8));
  if (contract.adapter === 'tree') body = csharpTreeBody(contract, a, Math.max(32, JSON.stringify(a).length * 4 + 8));
  if (contract.adapter === 'quad-tree') body = `var root=new Solution().${contract.callable.name}(${intMatrix(a[0], 'csharp')});var value=new System.Collections.Generic.List<object>();var pending=new System.Collections.Generic.Stack<System.Tuple<Solution.QuadNode,int,int>>();var seen=new System.Collections.Generic.HashSet<Solution.QuadNode>();if(root!=null)pending.Push(System.Tuple.Create(root,1,0));while(pending.Count>0){var item=pending.Pop();var node=item.Item1;int path=item.Item2,depth=item.Item3;if(!seen.Add(node))throw new System.Exception("Cyclic or shared quad-tree output");if(depth>16||seen.Count>${Math.max(32, JSON.stringify(a).length * 4 + 8)})throw new System.Exception("Quad-tree output exceeded traversal limit");var children=new[]{node.topLeft,node.topRight,node.bottomLeft,node.bottomRight};if(node.isLeaf){foreach(var child in children)if(child!=null)throw new System.Exception("Quad-tree leaf has children");}else foreach(var child in children)if(child==null)throw new System.Exception("Quad-tree internal node is malformed");value.Add(new int[]{path,node.isLeaf?1:0,node.val?1:0});if(!node.isLeaf)for(int slot=3;slot>=0;slot--)pending.Push(System.Tuple.Create(children[slot],path*4+slot,depth+1));}`;
  if (contract.adapter === 'graph') body = `int[][] adj=${matrix(a[0])};var ns=new Solution.GraphNode[adj.Length];for(int i=0;i<adj.Length;i++)ns[i]=new Solution.GraphNode(i+1,adj[i].Length);for(int i=0;i<adj.Length;i++)for(int j=0;j<adj[i].Length;j++)ns[i].neighbors[j]=ns[adj[i][j]-1];var original=ns.Length==0?null:ns[0];var root=new Solution().cloneGraph(original);if(original!=null&&object.ReferenceEquals(root,original))throw new System.Exception("Graph result must be a clone");object value=Graph(root,adj.Length,${Math.max(32, a[0].length * 8 + 8)});`;
  if (contract.adapter === 'stateful') body = managedStatefulBody(contract, a, 'csharp');
  return `${source}\npublic static class Program{static readonly System.Collections.Generic.List<object> Original=new System.Collections.Generic.List<object>();static bool IsOriginal(object n){foreach(var x in Original)if(object.ReferenceEquals(x,n))return true;return false;}static Solution.TreeNode FindNode(Solution.TreeNode root,int value){var q=new System.Collections.Generic.Queue<Solution.TreeNode>();if(root!=null)q.Enqueue(root);Solution.TreeNode found=null;while(q.Count>0){var n=q.Dequeue();if(n.val==value){if(found!=null)throw new System.Exception("Tree node value selector is ambiguous");found=n;}if(n.left!=null)q.Enqueue(n.left);if(n.right!=null)q.Enqueue(n.right);}if(found==null)throw new System.Exception("Tree node selector did not resolve");return found;}static string Quote(string s){var b=new System.Text.StringBuilder("\\\"");foreach(char c in s){if(c=='\\\"'||c=='\\\\')b.Append('\\\\').Append(c);else if(c=='\\n')b.Append("\\\\n");else if(c=='\\r')b.Append("\\\\r");else if(c=='\\t')b.Append("\\\\t");else if(c<32)b.Append("\\\\u").Append(((int)c).ToString("x4"));else b.Append(c);}return b.Append('\\\"').ToString();}static string Json(object v){if(v==null)return"null";if(v is string)return Quote((string)v);if(v is bool)return((bool)v)?"true":"false";if(v is int)return v.ToString();if(v is double)return((double)v).ToString("R",System.Globalization.CultureInfo.InvariantCulture);if(v is float)return((float)v).ToString("R",System.Globalization.CultureInfo.InvariantCulture);if(v is int[] a)return"["+string.Join(",",a)+"]";if(v is int[][]m){var r=new string[m.Length];for(int i=0;i<m.Length;i++)r[i]=Json(m[i]);return"["+string.Join(",",r)+"]";}if(v is System.Collections.IEnumerable e){var r=new System.Collections.Generic.List<string>();foreach(var x in e)r.Add(Json(x));return"["+string.Join(",",r)+"]";}throw new System.Exception("Unsupported serialization");}static object List(Solution.ListNode n,int limit){var v=new System.Collections.Generic.List<int>();var s=new System.Collections.Generic.HashSet<Solution.ListNode>();while(n!=null&&v.Count<limit){if(!s.Add(n))throw new System.Exception("Cyclic linked-list output");v.Add(n.val);n=n.next;}return v;}static object Tree(Solution.TreeNode root,int limit){var v=new System.Collections.Generic.List<object>();var q=new System.Collections.Generic.Queue<Solution.TreeNode>();var s=new System.Collections.Generic.HashSet<Solution.TreeNode>();if(root!=null)q.Enqueue(root);while(q.Count>0&&v.Count<limit){var n=q.Dequeue();if(n==null){v.Add(null);continue;}if(!s.Add(n))throw new System.Exception("Cyclic tree output");v.Add(n.val);q.Enqueue(n.left);q.Enqueue(n.right);}while(v.Count>0&&v[v.Count-1]==null)v.RemoveAt(v.Count-1);return v;}static int[][] Graph(Solution.GraphNode root,int size,int limit){var v=new int[size][];var q=new System.Collections.Generic.Queue<Solution.GraphNode>();var s=new System.Collections.Generic.HashSet<Solution.GraphNode>();if(root!=null)q.Enqueue(root);while(q.Count>0&&s.Count<limit){var n=q.Dequeue();if(!s.Add(n))continue;v[n.val-1]=new int[n.neighbors.Length];for(int i=0;i<n.neighbors.Length;i++){v[n.val-1][i]=n.neighbors[i].val;q.Enqueue(n.neighbors[i]);}}return v;}public static void Main(){${body}System.Console.WriteLine("${RESULT_PREFIX}"+"{\\\"value\\\":"+Json(value)+"}");}}`;
}

export function createManagedFamilyHarness({ language, source, contract, fixture }) {
  if (language === 'java') return java(source, contract, fixture);
  if (language === 'csharp') return csharp(source, contract, fixture);
  return null;
}
