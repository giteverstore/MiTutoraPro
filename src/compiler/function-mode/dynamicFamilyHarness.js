import { RESULT_PREFIX } from './containsDuplicateHarness';

const json = (value) => JSON.stringify(value);
const limitFor = (fixture) => Math.max(32, JSON.stringify(fixture.arguments ?? []).length * 4);

const callableIndexes = (contract) => contract.callableArgumentIndexes ?? contract.arguments.map(({ index }) => index);

function statefulOperations(contract, language) {
  const model = contract.stateful;
  // Harness bodies are selected from object literals below, whose values are
  // evaluated eagerly. Non-stateful contracts therefore need a harmless
  // unused stateful branch.
  if (!model) return '';
  const ref = (index) => language === 'php' ? `$a[${index}]` : language === 'r' ? `a[[${index + 1}]]` : language === 'python' ? `__a[${index}]` : `a[${index}]`;
  const ctor = model.constructorArgumentIndexes.map(ref).join(',');
  if (model.scalarOperation) {
    const op = model.scalarOperation;
    const result = (call) => op.resultType === 'boolean-integer' ? ({ python: `int(${call})`, javascript: `Number(${call})`, php: `(int)${call}`, r: `as.integer(${call})` })[language] : call;
    if (language === 'python') return `__s=${model.className}(${ctor}); __v=[]\nfor __item in __a[${model.operationArgumentIndex}]:\n    ${op.collect ? `__v.append(${result(`__s.${op.method}(__item)`)})` : `__s.${op.method}(__item)`}`;
    if (language === 'javascript') return `const s=new ${model.className}(${ctor});v=[];for(const item of a[${model.operationArgumentIndex}]){${op.collect ? `v.push(${result(`s.${op.method}(item)`)})` : `s.${op.method}(item)`}}`;
    if (language === 'php') return `$s=new ${model.className}(${ctor});$v=[];foreach($a[${model.operationArgumentIndex}] as $item){${op.collect ? `$v[]=${result(`$s->${op.method}($item)`)}` : `$s->${op.method}($item)`};}`;
    return `s<-${model.className}(${ctor});v<-list();for(item in a[[${model.operationArgumentIndex + 1}]]){${op.collect ? `v<-append(v,list(${result(`s[['${op.method}']](item)`) }))` : `s[['${op.method}']](item)`}}`;
  }
  const entries = Object.entries(model.operations);
  const argument = (op, at, index) => {
    const type = op.argumentTypes[index] ?? (Array.isArray(at) ? 'integer-array' : null);
    const one = (position) => language === 'python' ? `__op[${position}]` : language === 'javascript' ? `op[${position}]` : language === 'php' ? `$op[${position}]` : `op[[${position + 1}]]`;
    if (Array.isArray(at)) {
      const values = at.map(one);
      return language === 'php' ? `[${values.join(',')}]` : language === 'r' ? `as.integer(c(${values.join(',')}))` : `[${values.join(',')}]`;
    }
    const value = one(at);
    if (type === 'integer') return language === 'python' ? `int(${value})` : language === 'javascript' ? `Number(${value})` : language === 'php' ? `(int)${value}` : `as.integer(${value})`;
    if (type === 'number') return language === 'python' ? `float(${value})` : language === 'javascript' ? `Number(${value})` : language === 'php' ? `(float)${value}` : `as.numeric(${value})`;
    return value;
  };
  if (language === 'python') {
    const cases = entries.map(([opcode, op], index) => {
      const args = op.argumentIndexes.map((at, position) => argument(op, at, position)).join(',');
      const call = `__s.${op.method}(${args})`;
      const result = op.resultType === 'boolean-integer' ? `int(${call})` : call;
      return `${index ? 'elif' : 'if'} __op[0]==${json(Number.isNaN(Number(opcode)) ? opcode : Number(opcode))}: ${op.collect ? `__v.append(${result})` : call}`;
    }).join('\n    ');
    return `__s=${model.className}(${ctor}); __v=[]\nfor __op in __a[${model.operationArgumentIndex}]:\n    ${cases}\n    else: raise ValueError('Unknown stateful operation')`;
  }
  if (language === 'javascript') {
    const cases = entries.map(([opcode, op]) => {
      const args = op.argumentIndexes.map((at, position) => argument(op, at, position)).join(',');
      const call = `s.${op.method}(${args})`;
      const result = op.resultType === 'boolean-integer' ? `Number(${call})` : call;
      return `case ${json(Number.isNaN(Number(opcode)) ? opcode : Number(opcode))}:${op.collect ? `v.push(${result})` : call};break;`;
    }).join('');
    return `const s=new ${model.className}(${ctor});v=[];for(const op of a[${model.operationArgumentIndex}]){switch(op[0]){${cases}default:throw Error('Unknown stateful operation')}}`;
  }
  if (language === 'php') {
    const cases = entries.map(([opcode, op], index) => {
      const args = op.argumentIndexes.map((at, position) => argument(op, at, position)).join(',');
      const call = `$s->${op.method}(${args})`;
      const result = op.resultType === 'boolean-integer' ? `(int)${call}` : call;
      return `${index ? 'elseif' : 'if'}($op[0]===${json(Number.isNaN(Number(opcode)) ? opcode : Number(opcode))})${op.collect ? `$v[]=${result};` : `${call};`}`;
    }).join('');
    return `$s=new ${model.className}(${ctor});$v=[];foreach($a[${model.operationArgumentIndex}] as $op){${cases}else throw new Exception('Unknown stateful operation');}`;
  }
  const cases = entries.map(([opcode, op], index) => {
    const args = op.argumentIndexes.map((at, position) => argument(op, at, position)).join(',');
    const call = `s[['${op.method}']](${args})`;
    const literal = Number.isNaN(Number(opcode)) ? json(opcode) : `${Number(opcode)}L`;
    const result = op.resultType === 'boolean-integer' ? `as.integer(${call})` : call;
    return `${index ? 'else if' : 'if'}(op[[1]]==${literal})${op.collect ? `v<-append(v,list(${result}))` : call}`;
  }).join(' ');
  return `s<-${model.className}(${ctor});v<-list();for(op in a[[${model.operationArgumentIndex + 1}]]){${cases} else stop('Unknown stateful operation')}`;
}

function pythonLinkedList(contract) {
  const resultSource = contract.resultSource ?? { kind: 'return-value' };
  const call = `${contract.callable.name}(${callableIndexes(contract).map((index) => `__args[${index}]`).join(',')})`;
  const source = resultSource.kind === 'mutated-argument' ? `__result=__args[${resultSource.argumentIndex}]` : '__result=__returned';
  return `__args=[]; __original=set()
def __list(values, cycle=-1):
    cls=RandomNode if values and isinstance(values[0],list) else ListNode
    ns=[cls(row[0] if isinstance(row,list) else row) for row in values]
    for i in range(len(ns)-1): ns[i].next=ns[i+1]
    if ns and cycle>=0: ns[-1].next=ns[cycle]
    if values and isinstance(values[0],list):
        for i,row in enumerate(values): ns[i].random=None if row[1]<0 else ns[row[1]]
    __original.update(map(id,ns)); return (ns[0] if ns else None),ns
for __i,__desc in enumerate(${json(contract.arguments)}):
    __t=__desc['type']; __raw=__a[__i]
    if __t in ('linked-list','random-linked-list','cyclic-linked-list'):
        __head,__nodes=__list(__raw,__a[__i+1] if __t=='cyclic-linked-list' else -1); __args.append(__head)
    elif __t=='linked-list-array':
        __heads=[]
        for __row in __raw: __head,__nodes=__list(__row); __heads.append(__head)
        __args.append(__heads)
    else: __args.append(__raw)
__returned=${call}
${source}
if ${JSON.stringify(resultSource.kind)}=='return-value': __v=__result
else:
    __v=[]; __seen=set(); __nodes=[]; __node=__result
    while __node is not None and len(__v)<__limit:
        if id(__node) in __seen: raise ValueError('Cyclic linked-list output')
        __seen.add(id(__node)); __nodes.append(__node); __v.append(__node.val); __node=__node.next
    if __node is not None: raise ValueError('Linked-list output exceeded traversal limit')
    if ${contract.includeRandom === true ? 'True' : 'False'}:
        __at={id(n):i for i,n in enumerate(__nodes)}
        __v=[[n.val,-1 if n.random is None else __at.get(id(n.random),-2)] for n in __nodes]
        if any(row[1]==-2 for row in __v): raise ValueError('Random pointer targets an unreachable node')
    __reuse=sum(id(n) in __original for n in __nodes)
    if ${json(contract.identityPolicy)}=='reuse-input-nodes' and __reuse!=len(__nodes): raise ValueError('Linked-list output introduced a new node')
    if ${json(contract.identityPolicy)} in ('allocate-new-list','no-original-node-reuse') and __reuse: raise ValueError('Linked-list output illegally reused an input node')`;
}

function javascriptLinkedList(contract) {
  const resultSource = contract.resultSource ?? { kind: 'return-value' };
  const call = `${contract.callable.name}(${callableIndexes(contract).map((index) => `args[${index}]`).join(',')})`;
  const source = resultSource.kind === 'mutated-argument' ? `result=args[${resultSource.argumentIndex}];` : 'result=returned;';
  return `const args=[],original=new Set();function list(values,cycle=-1){const C=values.length&&Array.isArray(values[0])?RandomNode:ListNode,ns=values.map(x=>new C(Array.isArray(x)?x[0]:x));for(let i=0;i+1<ns.length;i++)ns[i].next=ns[i+1];if(ns.length&&cycle>=0)ns.at(-1).next=ns[cycle];if(values.length&&Array.isArray(values[0]))values.forEach((x,i)=>ns[i].random=x[1]<0?null:ns[x[1]]);ns.forEach(x=>original.add(x));return [ns[0]??null,ns]}
${contract.arguments.map(({ type }, i) => type === 'linked-list-array'
    ? `{const hs=a[${i}].map(x=>list(x)[0]);args.push(hs);}`
    : ['linked-list', 'random-linked-list', 'cyclic-linked-list'].includes(type)
      ? `{const [h]=list(a[${i}],${type === 'cyclic-linked-list' ? `a[${i + 1}]` : '-1'});args.push(h);}`
      : `args.push(a[${i}]);`).join('')}
const returned=${call};let result;${source}if(${json(resultSource.kind)}==='return-value')v=result;else{v=[];const nodes=[],seen=new Set();let n=result;while(n&&v.length<limit){if(seen.has(n))throw Error('Cyclic linked-list output');seen.add(n);nodes.push(n);v.push(n.val);n=n.next}if(n)throw Error('Linked-list output exceeded traversal limit');if(${contract.includeRandom === true}){const at=new Map(nodes.map((x,i)=>[x,i]));v=nodes.map(x=>[x.val,x.random==null?-1:(at.get(x.random)??-2)]);if(v.some(x=>x[1]===-2))throw Error('Random pointer targets an unreachable node')}const reuse=nodes.filter(x=>original.has(x)).length;if(${json(contract.identityPolicy)}==='reuse-input-nodes'&&reuse!==nodes.length)throw Error('Linked-list output introduced a new node');if(['allocate-new-list','no-original-node-reuse'].includes(${json(contract.identityPolicy)})&&reuse)throw Error('Linked-list output illegally reused an input node')}`;
}

// Tree fixtures are level-order arrays only at the harness boundary.  Learner
// callables always receive real starter-compatible nodes, and the bounded
// serializer is shared by every tree/BST contract.
function pythonTree(contract) {
  const argumentsSource = callableIndexes(contract).map((index) => `__args[${index}]`).join(',');
  const call = contract.resultSource?.kind === 'codec-round-trip'
    ? `${contract.resultSource.decode}(${contract.resultSource.encode}(${argumentsSource}))`
    : `${contract.callable.name}(${argumentsSource})`;
  const result = contract.resultSource?.kind === 'mutated-argument'
    ? `__returned=${call}\n__result=__args[${contract.resultSource.argumentIndex}]`
    : `__result=${call}`;
  const returnsTree = ['level-order-tree', 'returned-tree', 'returned-subtree'].includes(contract.returns.type);
  const returnsNode = contract.returns.type === 'returned-node';
  return `__args=[];__original=set()
def __tree(values):
    __nodes=[None if x is None else TreeNode(x) for x in values]
    __queue=[__nodes[0]] if __nodes and __nodes[0] is not None else [];__pos=1
    while __queue and __pos<len(__nodes):
        __node=__queue.pop(0)
        __node.left=__nodes[__pos] if __pos<len(__nodes) else None;__pos+=1
        if __node.left is not None: __queue.append(__node.left)
        __node.right=__nodes[__pos] if __pos<len(__nodes) else None;__pos+=1
        if __node.right is not None: __queue.append(__node.right)
    for __node in __nodes:
        if __node is not None: __original.add(id(__node))
    return __nodes[0] if __nodes else None
for __i,__desc in enumerate(${json(contract.arguments)}):
    __args.append(__tree(__a[__i]) if __desc['type'] in ('binary-tree','bst','tree','level-order-tree') else __a[__i])
__selectors=__j.loads(${json(json(contract.nodeReferenceArguments ?? {}))})
for __i,__desc in enumerate(${json(contract.arguments)}):
    if __desc['type']=='tree-node-reference':
        __root=__args[__selectors.get(str(__i),{}).get('rootArgumentIndex',0)]
        __want=__a[__i];__pending=[__root] if __root is not None else [];__matches=[]
        while __pending:
            __candidate=__pending.pop(0)
            if __candidate.val==__want: __matches.append(__candidate)
            if __candidate.left is not None: __pending.append(__candidate.left)
            if __candidate.right is not None: __pending.append(__candidate.right)
        if len(__matches)!=1: raise ValueError('Tree node reference selector did not resolve uniquely')
        __args[__i]=__matches[0]
${result}
${returnsNode ? `if __result is not None and id(__result) not in __original: raise ValueError('Returned tree node is not an original fixture node')
__v=None if __result is None else __result.val` : returnsTree ? `__v=[];__queue=[__result] if __result is not None else [];__seen=set()
while __queue and len(__v)<__limit:
    __node=__queue.pop(0)
    if __node is None: __v.append(None);continue
    if id(__node) in __seen: raise ValueError('Cyclic or shared tree output')
    __seen.add(id(__node));__v.append(__node.val);__queue.extend([getattr(__node,'left',None),getattr(__node,'right',None)])
if __queue: raise ValueError('Tree output exceeded traversal limit')
while __v and __v[-1] is None: __v.pop()` : '__v=__result'}`;
}

function javascriptTree(contract) {
  const argumentsSource = callableIndexes(contract).map((index) => `args[${index}]`).join(',');
  const call = contract.resultSource?.kind === 'codec-round-trip'
    ? `${contract.resultSource.decode}(${contract.resultSource.encode}(${argumentsSource}))`
    : `${contract.callable.name}(${argumentsSource})`;
  const returnsTree = ['level-order-tree', 'returned-tree', 'returned-subtree'].includes(contract.returns.type);
  const returnsNode = contract.returns.type === 'returned-node';
  const select = contract.resultSource?.kind === 'mutated-argument'
    ? `const returned=${call};const result=args[${contract.resultSource.argumentIndex}];`
    : `const result=${call};`;
  return `const args=[],original=new Set();function tree(values){const ns=values.map(x=>x===null?null:new TreeNode(x));const queue=ns[0]?[ns[0]]:[];let pos=1;while(queue.length&&pos<ns.length){const node=queue.shift();node.left=ns[pos++]??null;if(node.left)queue.push(node.left);node.right=ns[pos++]??null;if(node.right)queue.push(node.right)}ns.forEach(node=>{if(node)original.add(node)});return ns[0]??null}
${contract.arguments.map(({ type }, i) => ['binary-tree', 'bst', 'tree', 'level-order-tree'].includes(type) ? `args.push(tree(a[${i}]));` : `args.push(a[${i}]);`).join('')}
${contract.arguments.map(({ type }, i) => type === 'tree-node-reference' ? `{const want=a[${i}],queue=args[${contract.nodeReferenceArguments?.[i]?.rootArgumentIndex ?? 0}]?[args[${contract.nodeReferenceArguments?.[i]?.rootArgumentIndex ?? 0}]]:[],matches=[];while(queue.length){const node=queue.shift();if(node.val===want)matches.push(node);if(node.left)queue.push(node.left);if(node.right)queue.push(node.right)}if(matches.length!==1)throw Error('Tree node reference selector did not resolve uniquely');args[${i}]=matches[0];}` : '').join('')}
${select}${returnsNode ? `if(result&&!original.has(result))throw Error('Returned tree node is not an original fixture node');v=result?result.val:null;` : returnsTree ? `v=[];const queue=result?[result]:[],seen=new Set();while(queue.length&&v.length<limit){const node=queue.shift();if(!node){v.push(null);continue}if(seen.has(node))throw Error('Cyclic or shared tree output');seen.add(node);v.push(node.val);queue.push(node.left??null,node.right??null)}if(queue.length)throw Error('Tree output exceeded traversal limit');while(v.at(-1)===null)v.pop();` : 'v=result;'}`;
}

function pythonQuadTree(contract) {
  return `__root=${contract.callable.name}(__a[0]);__v=[];__pending=[(__root,1,0)] if __root is not None else [];__seen=set()
while __pending:
    __node,__path,__depth=__pending.pop()
    if id(__node) in __seen: raise ValueError('Cyclic or shared quad-tree output')
    if __depth>16 or len(__seen)>=__limit: raise ValueError('Quad-tree output exceeded traversal limit')
    __seen.add(id(__node));__leaf=bool(__node.isLeaf);__children=[__node.topLeft,__node.topRight,__node.bottomLeft,__node.bottomRight]
    if __leaf and any(x is not None for x in __children): raise ValueError('Quad-tree leaf has children')
    if not __leaf and any(x is None for x in __children): raise ValueError('Quad-tree internal node is malformed')
    __v.append([__path,1 if __leaf else 0,1 if bool(__node.val) else 0])
    if not __leaf:
        for __slot in range(3,-1,-1): __pending.append((__children[__slot],__path*4+__slot,__depth+1))`;
}

function javascriptQuadTree(contract) {
  return `const root=${contract.callable.name}(a[0]);v=[];const pending=root?[[root,1,0]]:[],seen=new Set();while(pending.length){const [node,path,depth]=pending.pop();if(seen.has(node))throw Error('Cyclic or shared quad-tree output');if(depth>16||seen.size>=limit)throw Error('Quad-tree output exceeded traversal limit');seen.add(node);const leaf=!!node.isLeaf,children=[node.topLeft,node.topRight,node.bottomLeft,node.bottomRight];if(leaf&&children.some(Boolean))throw Error('Quad-tree leaf has children');if(!leaf&&children.some(x=>!x))throw Error('Quad-tree internal node is malformed');v.push([path,leaf?1:0,node.val?1:0]);if(!leaf)for(let slot=3;slot>=0;slot--)pending.push([children[slot],path*4+slot,depth+1])}`;
}

function pythonHarness(source, contract, fixture) {
  const args = json(fixture.arguments ?? []);
  return `${source}\n\nimport json as __j\n__a=__j.loads(${json(args)})\n__limit=${limitFor(fixture)}\n${({
    'plain-return': `__v=${contract.callable.name}(*__a)`,
    'semantic-collection': `__v=${contract.callable.name}(*__a)`,
    mutation: `${contract.callable.name}(*__a)\n__v=__a[${contract.mutation.target}]`,
    'valid-prefix-mutation': `__k=${contract.callable.name}(*__a)\n__v=[__k,*__a[${contract.mutation.target}][:__k]]`,
    'linked-list': pythonLinkedList(contract),
    tree: pythonTree(contract),
    'quad-tree': pythonQuadTree(contract),
    graph: `__adj=__a[0]; __nodes=[Node(i+1) for i in range(len(__adj))]\nfor __i,__row in enumerate(__adj): __nodes[__i].neighbors=[__nodes[j-1] for j in __row]\n__original=__nodes[0] if __nodes else None; __root=${contract.callable.name}(__original)\nif __original is not None and __root is __original: raise ValueError('Graph result must be a clone')\n__v=[[] for _ in __adj]; __q=[__root] if __root else []; __seen=set()\nwhile __q and len(__seen)<__limit:\n    __n=__q.pop(0)\n    if id(__n) in __seen: continue\n    __seen.add(id(__n)); __v[__n.val-1]=[x.val for x in __n.neighbors]; __q.extend(__n.neighbors)\nif __q: raise ValueError('Graph output exceeded traversal limit')`,
    stateful: statefulOperations(contract, 'python'),
  })[contract.adapter]}\nprint('${RESULT_PREFIX}'+__j.dumps({'value':__v},separators=(',',':')))\n`;
}

function javascriptHarness(source, contract, fixture) {
  const args = json(fixture.arguments ?? []);
  const nodeName = contract.questionId === 'BLIND150-082' ? 'GraphNode' : contract.adapter === 'tree' ? 'TreeNode' : 'ListNode';
  return `${source}\n\n(()=>{const a=${args},limit=${limitFor(fixture)};let v;${({
    'plain-return': `v=${contract.callable.name}(...a);`,
    'semantic-collection': `v=${contract.callable.name}(...a);`,
    mutation: `${contract.callable.name}(...a);v=a[${contract.mutation.target}];`,
    'valid-prefix-mutation': `const k=${contract.callable.name}(...a);v=[k,...a[${contract.mutation.target}].slice(0,k)];`,
    'linked-list': javascriptLinkedList(contract),
    tree: javascriptTree(contract),
    'quad-tree': javascriptQuadTree(contract),
    graph: `const ns=a[0].map((_,i)=>new ${nodeName}(i+1));a[0].forEach((row,i)=>ns[i].neighbors=row.map(x=>ns[x-1]));const original=ns[0]??null,root=${contract.callable.name}(original);if(original&&root===original)throw Error('Graph result must be a clone');v=a[0].map(()=>[]);const q=root?[root]:[],seen=new Set();while(q.length&&seen.size<limit){const n=q.shift();if(seen.has(n))continue;seen.add(n);v[n.val-1]=n.neighbors.map(x=>x.val);q.push(...n.neighbors)}if(q.length)throw Error('Graph output exceeded traversal limit');`,
    stateful: statefulOperations(contract, 'javascript'),
  })[contract.adapter]}console.log('${RESULT_PREFIX}'+JSON.stringify({value:v}));})();\n`;
}

function phpHarness(source, contract, fixture) {
  const args = json(fixture.arguments ?? []);
  const call = `${contract.callable.name}(...$a)`;
  let body = `$v=${call};`;
  if (contract.adapter === 'mutation') body = `${call};$v=$a[${contract.mutation.target}];`;
  if (contract.adapter === 'valid-prefix-mutation') body = `$k=${call};$v=array_merge([$k],array_slice($a[${contract.mutation.target}],0,$k));`;
  if (contract.adapter === 'linked-list') {
    const resultSource = contract.resultSource ?? { kind: 'return-value' };
    const argumentsSource = callableIndexes(contract).map((index) => `$args[${index}]`).join(',');
    const invoke = resultSource.kind === 'codec-round-trip'
      ? `${resultSource.decode}(${resultSource.encode}(${argumentsSource}))`
      : `${contract.callable.name}(${argumentsSource})`;
    const select = resultSource.kind === 'mutated-argument' ? `$result=$args[${resultSource.argumentIndex}];` : '$result=$returned;';
    body = `$args=[];$original=[];$build=function($values,$cycle=-1)use(&$original){$class=count($values)&&is_array($values[0])?'RandomNode':'ListNode';$ns=[];foreach($values as $row){$value=is_array($row)?$row[0]:$row;$ns[]=new $class($value);}for($i=0;$i+1<count($ns);$i++)$ns[$i]->next=$ns[$i+1];if($ns&&$cycle>=0)$ns[count($ns)-1]->next=$ns[$cycle];if($values&&is_array($values[0]))foreach($values as $i=>$row)$ns[$i]->random=$row[1]<0?null:$ns[$row[1]];foreach($ns as $n)$original[spl_object_id($n)]=1;return [$ns[0]??null,$ns];};`
      + contract.arguments.map(({ type }, i) => type === 'linked-list-array'
        ? `$heads=[];foreach($a[${i}] as $row)$heads[]=$build($row)[0];$args[]=$heads;`
        : ['linked-list', 'random-linked-list', 'cyclic-linked-list'].includes(type)
          ? `$args[]=$build($a[${i}],${type === 'cyclic-linked-list' ? `$a[${i + 1}]` : '-1'})[0];`
          : `$args[]=$a[${i}];`).join('')
      + `$returned=${invoke};${select}if(${json(resultSource.kind)}==='return-value')$v=$result;else{$v=[];$nodes=[];$seen=[];$n=$result;while($n&&count($v)<$limit){$id=spl_object_id($n);if(isset($seen[$id]))throw new Exception('Cyclic linked-list output');$seen[$id]=1;$nodes[]=$n;$v[]=$n->val;$n=$n->next;}if($n)throw new Exception('Linked-list output exceeded traversal limit');if(${contract.includeRandom === true}){$at=[];foreach($nodes as $i=>$node)$at[spl_object_id($node)]=$i;$rows=[];foreach($nodes as $node){$ri=$node->random===null?-1:($at[spl_object_id($node->random)]??-2);if($ri===-2)throw new Exception('Random pointer targets an unreachable node');$rows[]=[$node->val,$ri];}$v=$rows;}$reuse=0;foreach($nodes as $node)if(isset($original[spl_object_id($node)]))$reuse++;if(${json(contract.identityPolicy)}==='reuse-input-nodes'&&$reuse!==count($nodes))throw new Exception('Linked-list output introduced a new node');if(in_array(${json(contract.identityPolicy)},['allocate-new-list','no-original-node-reuse'],true)&&$reuse)throw new Exception('Linked-list output illegally reused an input node');}`;
  }
  if (contract.adapter === 'tree') {
    const argumentsSource = callableIndexes(contract).map((index) => `$args[${index}]`).join(',');
    const invoke = contract.resultSource?.kind === 'codec-round-trip'
      ? `${contract.resultSource.decode}(${contract.resultSource.encode}(${argumentsSource}))`
      : `${contract.callable.name}(${argumentsSource})`;
    const result = contract.resultSource?.kind === 'mutated-argument' ? `$returned=${invoke};$result=$args[${contract.resultSource.argumentIndex}];` : `$result=${invoke};`;
    const tree = ['level-order-tree', 'returned-tree', 'returned-subtree'].includes(contract.returns.type);
    const returnedNode = contract.returns.type === 'returned-node';
    const references = contract.arguments.map(({ type }, index) => {
      if (type !== 'tree-node-reference') return '';
      const selector = contract.nodeReferenceArguments?.[index] ?? {};
      if (selector.selector !== 'value' || selector.requireUnique !== true) throw new Error(`Unsupported PHP tree node selector ${index}.`);
      const root = selector.rootArgumentIndex ?? 0;
      return `$want=$a[${index}];$q=$args[${root}]?[$args[${root}]]:[];$found=null;while($q){$n=array_shift($q);if($n->val===$want){if($found!==null)throw new Exception('Tree node value selector is ambiguous');$found=$n;}if($n->left)$q[]=$n->left;if($n->right)$q[]=$n->right;}if($found===null)throw new Exception('Tree node selector did not resolve');$args[${index}]=$found;`;
    }).join('');
    body = `$args=[];$original=[];$build=function($values)use(&$original){$nodes=[];foreach($values as $value)$nodes[]=$value===null?null:new TreeNode($value);$queue=isset($nodes[0])&&$nodes[0]?$nodes[0]===null?[]:[$nodes[0]]:[];$pos=1;while($queue&&$pos<count($nodes)){$node=array_shift($queue);$node->left=$nodes[$pos++]??null;if($node->left)$queue[]=$node->left;$node->right=$nodes[$pos++]??null;if($node->right)$queue[]=$node->right;}foreach($nodes as $node)if($node)$original[spl_object_id($node)]=1;return $nodes[0]??null;};`
      + contract.arguments.map(({ type }, index) => ['binary-tree', 'bst', 'tree', 'level-order-tree'].includes(type) ? `$args[]=$build($a[${index}]);` : `$args[]=$a[${index}];`).join('')
      + references
      + result
      + (returnedNode ? `if($result!==null&&!isset($original[spl_object_id($result)]))throw new Exception('Returned tree node is not an original fixture node');$v=$result?->val;` : tree ? `$q=$result?[$result]:[];$v=[];$seen=[];while($q&&count($v)<$limit){$n=array_shift($q);if(!$n){$v[]=null;continue;}$id=spl_object_id($n);if(isset($seen[$id]))throw new Exception('Cyclic or shared tree output');$seen[$id]=1;$v[]=$n->val;$q[]=$n->left??null;$q[]=$n->right??null;}if($q)throw new Exception('Tree output exceeded traversal limit');while($v&&end($v)===null)array_pop($v);` : '$v=$result;');
  }
  if (contract.adapter === 'quad-tree') body = `$root=${contract.callable.name}($a[0]);$v=[];$pending=$root?[[$root,1,0]]:[];$seen=[];while($pending){[$node,$path,$depth]=array_pop($pending);$id=spl_object_id($node);if(isset($seen[$id]))throw new Exception('Cyclic or shared quad-tree output');if($depth>16||count($seen)>=$limit)throw new Exception('Quad-tree output exceeded traversal limit');$seen[$id]=1;$leaf=(bool)$node->isLeaf;$children=[$node->topLeft,$node->topRight,$node->bottomLeft,$node->bottomRight];if($leaf&&array_filter($children))throw new Exception('Quad-tree leaf has children');if(!$leaf&&count(array_filter($children))!==4)throw new Exception('Quad-tree internal node is malformed');$v[]=[$path,$leaf?1:0,$node->val?1:0];if(!$leaf)for($slot=3;$slot>=0;$slot--)$pending[]=[$children[$slot],$path*4+$slot,$depth+1];}`;
  if (contract.adapter === 'graph') body = `$ns=[];foreach($a[0] as $i=>$_)$ns[]=new GraphNode($i+1);foreach($a[0] as $i=>$row)$ns[$i]->neighbors=array_map(fn($x)=>$ns[$x-1],$row);$original=$ns[0]??null;$root=cloneGraph($original);if($original&&$root===$original)throw new Exception('Graph result must be a clone');$v=array_fill(0,count($a[0]),[]);$q=$root?[$root]:[];$seen=[];while($q&&count($seen)<$limit){$n=array_shift($q);$id=spl_object_id($n);if(isset($seen[$id]))continue;$seen[$id]=1;$v[$n->val-1]=array_map(fn($x)=>$x->val,$n->neighbors);array_push($q,...$n->neighbors);}`;
  if (contract.adapter === 'stateful') body = statefulOperations(contract, 'php');
  return `${source.replace(/\?>\s*$/, '')}\n$a=json_decode('${args}',true);$limit=${limitFor(fixture)};${body}echo '${RESULT_PREFIX}'.json_encode(['value'=>$v]).PHP_EOL;\n`;
}

function rHarness(source, contract, fixture) {
  const rlit = (value) => Array.isArray(value)
    ? `${value.every((entry) => !Array.isArray(entry) && entry !== null) ? 'c' : 'list'}(${value.map(rlit).join(',')})`
    : value === null ? 'NULL' : typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : typeof value === 'string' ? JSON.stringify(value) : String(value);
  const typedRlit = (value, type) => {
    const literal = rlit(value);
    if (type === 'integer') return `as.integer(${literal})`;
    // R's integer type cannot represent the full signed 32-bit fixture range
    // (notably -2147483648); numeric vectors preserve every int32 value exactly.
    if (type === 'integer-array') return `as.numeric(${literal})`;
    if (type === 'number-array') return `as.numeric(${literal})`;
    if (type === 'integer-matrix') return `lapply(${literal},as.integer)`;
    return literal;
  };
  const args = `list(${(fixture.arguments ?? []).map((value, index) => typedRlit(value, contract.arguments?.[index]?.type)).join(',')})`;
  const plain = `v <- do.call(${contract.callable.name}, a)`;
  let body = plain;
  if (contract.adapter === 'mutation') body = `v <- do.call(${contract.callable.name}, a)`;
  if (contract.adapter === 'valid-prefix-mutation') body = `z <- do.call(${contract.callable.name}, a); k <- as.integer(z$k); v <- c(k,head(z$nums,k))`;
  if (contract.adapter === 'linked-list') {
    const resultSource = contract.resultSource ?? { kind: 'return-value' };
    const selectedArguments = `args[c(${callableIndexes(contract).map((index) => index + 1).join(',')})]`;
    const invoke = resultSource.kind === 'codec-round-trip'
      ? `do.call(${resultSource.decode},list(do.call(${resultSource.encode},${selectedArguments})))`
      : `do.call(${contract.callable.name},${selectedArguments})`;
    const select = resultSource.kind === 'mutated-argument' ? `result<-args[[${resultSource.argumentIndex + 1}]]` : 'result<-returned';
    body = `args<-list();original<-list();build<-function(values,cycle=-1L,random=FALSE){C<-if(random)RandomNode else ListNode;ns<-lapply(values,function(x)C(if(random)x[[1]] else x));if(length(ns)>1)for(i in seq_len(length(ns)-1))ns[[i]][['next']]<-ns[[i+1]];if(length(ns)&&cycle>=0)ns[[length(ns)]][['next']]<-ns[[cycle+1]];if(random)for(i in seq_along(values))ns[[i]]$random<-if(values[[i]][[2]]<0)NULL else ns[[values[[i]][[2]]+1]];original<<-c(original,ns);list(if(length(ns))ns[[1]] else NULL,ns)};`
      + contract.arguments.map(({ type }, i) => type === 'linked-list-array'
        ? `args[[${i + 1}]]<-lapply(a[[${i + 1}]],function(row)build(row)[[1]])`
        : ['linked-list', 'random-linked-list', 'cyclic-linked-list'].includes(type)
          ? `args[[${i + 1}]]<-build(a[[${i + 1}]],${type === 'cyclic-linked-list' ? `a[[${i + 2}]]` : '-1L'},${type === 'random-linked-list' ? 'TRUE' : 'FALSE'})[[1]]`
          : `args[[${i + 1}]]<-a[[${i + 1}]]`).join(';')
      + `;returned<-${invoke};${select};if(${json(resultSource.kind)}=='return-value')v<-result else{v<-c();nodes<-list();seen<-list();n<-result;while(!is.null(n)&&length(v)<limit){if(length(seen)&&any(vapply(seen,identical,logical(1),n)))stop('Cyclic linked-list output');seen[[length(seen)+1]]<-n;nodes[[length(nodes)+1]]<-n;v<-c(v,n$val);n<-n[['next']]};if(!is.null(n))stop('Linked-list output exceeded traversal limit');if(${contract.includeRandom === true ? 'TRUE' : 'FALSE'}){v<-lapply(nodes,function(node){ri<-if(is.null(node$random))-1L else{hits<-which(vapply(nodes,identical,logical(1),node$random));if(!length(hits))stop('Random pointer targets an unreachable node');hits[[1]]-1L};c(node$val,ri)})};reuse<-sum(vapply(nodes,function(node)length(original)&&any(vapply(original,identical,logical(1),node)),logical(1)));if(${json(contract.identityPolicy)}=='reuse-input-nodes'&&reuse!=length(nodes))stop('Linked-list output introduced a new node');if(${json(contract.identityPolicy)}%in%c('allocate-new-list','no-original-node-reuse')&&reuse)stop('Linked-list output illegally reused an input node')}`;
  }
  if (contract.adapter === 'stateful') body = statefulOperations(contract, 'r');
  // Tree and graph fixtures are decoded by a small JSON-compatible literal bridge below.
  if (contract.adapter === 'tree') {
    const selectedArguments = `args[c(${callableIndexes(contract).map((index) => index + 1).join(',')})]`;
    const invoke = contract.resultSource?.kind === 'codec-round-trip'
      ? `do.call(${contract.resultSource.decode},list(do.call(${contract.resultSource.encode},${selectedArguments})))`
      : `do.call(${contract.callable.name},${selectedArguments})`;
    const tree = ['level-order-tree', 'returned-tree', 'returned-subtree'].includes(contract.returns.type);
    const returnedNode = contract.returns.type === 'returned-node';
    const references = contract.arguments.map(({ type }, index) => {
      if (type !== 'tree-node-reference') return '';
      const selector = contract.nodeReferenceArguments?.[index] ?? {};
      if (selector.selector !== 'value' || selector.requireUnique !== true) throw new Error(`Unsupported R tree node selector ${index}.`);
      const root = selector.rootArgumentIndex ?? 0;
      return `want<-a[[${index + 1}]];q<-if(is.null(args[[${root + 1}]]))list()else list(args[[${root + 1}]]);found<-NULL;while(length(q)){n<-q[[1]];q<-q[-1];if(n$val==want){if(!is.null(found))stop('Tree node value selector is ambiguous');found<-n};if(!is.null(n$left))q[[length(q)+1]]<-n$left;if(!is.null(n$right))q[[length(q)+1]]<-n$right};if(is.null(found))stop('Tree node selector did not resolve');args[[${index + 1}]]<-found`;
    }).filter(Boolean).join(';');
    body = `args<-list()
original<-list()
build<-function(vals){
 ns<-lapply(vals,function(x){if(is.null(x))NULL else TreeNode(x)})
 q<-list()
 if(length(ns)>0&&!is.null(ns[[1]]))q[[1]]<-ns[[1]]
 pos<-2
 while(length(q)>0&&pos<=length(ns)){
  node<-q[[1]];q<-q[-1]
  if(pos<=length(ns))node$left<-ns[[pos]]
  pos<-pos+1
  if(!is.null(node$left))q[[length(q)+1]]<-node$left
  if(pos<=length(ns))node$right<-ns[[pos]]
  pos<-pos+1
  if(!is.null(node$right))q[[length(q)+1]]<-node$right
 }
 for(candidate in ns){if(!is.null(candidate))original<<-append(original,list(candidate))}
 if(length(ns)>0)return(ns[[1]])
 NULL
}
`
      + contract.arguments.map(({ type }, index) => ['binary-tree', 'bst', 'tree', 'level-order-tree'].includes(type) ? `args[[${index + 1}]]<-build(a[[${index + 1}]])` : `args[[${index + 1}]]<-a[[${index + 1}]]`).join(';')
      + (references ? `;${references}` : '')
      + `;result<-${invoke};`
      + (returnedNode ? `if(!is.null(result)&&!any(vapply(original,identical,logical(1),result)))stop('Returned tree node is not an original fixture node');v<-if(is.null(result))NULL else result$val` : tree ? `q<-if(is.null(result))list() else list(result);v<-list();seen<-list();while(length(q)&&length(v)<limit){n<-q[[1]];q<-q[-1];if(is.null(n)){v[length(v)+1]<-list(NULL)}else{if(length(seen)&&any(vapply(seen,identical,logical(1),n)))stop('Cyclic or shared tree output');seen[[length(seen)+1]]<-n;v[[length(v)+1]]<-n$val;q<-c(q,list(n$left,n$right))}};if(length(q))stop('Tree output exceeded traversal limit');while(length(v)&&is.null(v[[length(v)]]))v<-v[-length(v)]` : 'v<-result');
  }
  if (contract.adapter === 'quad-tree') body = `root<-${contract.callable.name}(a[[1]]);v<-list();pending<-if(is.null(root))list() else list(list(root,1L,0L));seen<-list();while(length(pending)){item<-pending[[length(pending)]];pending<-pending[-length(pending)];node<-item[[1]];path<-item[[2]];depth<-item[[3]];if(length(seen)&&any(vapply(seen,identical,logical(1),node)))stop('Cyclic or shared quad-tree output');if(depth>16||length(seen)>=limit)stop('Quad-tree output exceeded traversal limit');seen[[length(seen)+1]]<-node;leaf<-isTRUE(node$isLeaf);children<-list(node$topLeft,node$topRight,node$bottomLeft,node$bottomRight);if(leaf&&any(!vapply(children,is.null,logical(1))))stop('Quad-tree leaf has children');if(!leaf&&any(vapply(children,is.null,logical(1))))stop('Quad-tree internal node is malformed');v[[length(v)+1]]<-c(path,if(leaf)1L else 0L,if(isTRUE(node$val))1L else 0L);if(!leaf)for(slot in 4:1)pending[[length(pending)+1]]<-list(children[[slot]],path*4L+(slot-1L),depth+1L)}`;
  if (contract.adapter === 'graph') body = `adj<-a[[1]];ns<-lapply(seq_along(adj),function(i){n<-new.env();n$val<-i;n$neighbors<-list();n});for(i in seq_along(adj))ns[[i]]$neighbors<-lapply(adj[[i]],function(j)ns[[j]]);original<-if(length(ns))ns[[1]] else NULL;root<-cloneGraph(original);if(!is.null(original)&&identical(root,original))stop('Graph result must be a clone');v<-lapply(adj,function(x)numeric());q<-if(is.null(root))list() else list(root);seen<-list();while(length(q)&&length(seen)<limit){n<-q[[1]];q<-q[-1];if(any(vapply(seen,identical,logical(1),n)))next;seen[[length(seen)+1]]<-n;v[n$val]<-list(vapply(n$neighbors,function(x)x$val,numeric(1)));q<-c(q,n$neighbors)}`;
  const serialized = ['integer-array', 'number-array', 'string-array'].includes(contract.returns?.type)
    ? ".jsonarray(v)"
    : ['integer-matrix', 'string-matrix'].includes(contract.returns?.type) || ['semantic-collection', 'graph', 'quad-tree'].includes(contract.adapter) ? '.jsonrows(v)' : '.json(v)';
  return `${source}\na<-${args}\nlimit<-${limitFor(fixture)}\n.json<-function(x){if(is.null(x))return('null');if(is.character(x)&&length(x)==1)return(encodeString(x,quote='"'));if(is.logical(x)&&length(x)==1)return(if(x)'true' else 'false');if(is.numeric(x)&&length(x)==1)return(as.character(x));if(is.atomic(x))return(paste0('[',paste(vapply(as.list(x),.json,''),collapse=','),']'));if(is.list(x))return(paste0('[',paste(vapply(x,.json,''),collapse=','),']'));stop('Unsupported serialization')}\n.jsonarray<-function(x)paste0('[',paste(vapply(as.list(x),.json,''),collapse=','),']')\n.jsonrows<-function(x)paste0('[',paste(vapply(x,function(y){if(is.null(y))return('[]');if(is.atomic(y))return(paste0('[',paste(vapply(as.list(y),.json,''),collapse=','),']'));.json(y)},''),collapse=','),']')\n${body}\ncat('${RESULT_PREFIX}',paste0('{"value":',${serialized},'}'), '\\n',sep='')\n`;
}

export function createDynamicFamilyHarness({ language, source, contract, fixture }) {
  if (language === 'python') return pythonHarness(source, contract, fixture);
  if (language === 'javascript' || language === 'typescript') return javascriptHarness(source, contract, fixture);
  if (language === 'php') return phpHarness(source, contract, fixture);
  if (language === 'r') return rHarness(source, contract, fixture);
  return null;
}
