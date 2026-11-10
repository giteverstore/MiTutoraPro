import { RESULT_PREFIX } from './containsDuplicateHarness';

const arr = (values) => `{${values.join(',')}}`;
const limitFor = (fixture) => Math.max(32, JSON.stringify(fixture.arguments ?? []).length * 4);
const nativeStringLiteral = (value) => `"${String(value)
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')
  .replace(/\t/g, '\\t')}"`;
const cppStringArray = (values) => `std::vector<std::string>{${values.map(nativeStringLiteral).join(',')}}`;
const cppNumberArray = (values) => `std::vector<double>{${values.map(Number).join(',')}}`;
const cppIntMatrix = (rows) => `std::vector<std::vector<int>>{${rows.map((row) => `std::vector<int>{${row.join(',')}}`).join(',')}}`;
const cppStringMatrix = (rows) => `std::vector<std::vector<std::string>>{${rows.map(cppStringArray).join(',')}}`;
const callableIndexes = (contract) => contract.callableArgumentIndexes ?? contract.arguments.map(({ index }) => index);
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

function nativeStatefulHarness(source, contract, fixture, language) {
  const model = contract.stateful;
  if (!model) throw new Error('Stateful adapter requires declarative operation metadata.');
  const a = fixture.arguments ?? [];
  if (model.scalarOperation) {
    const values = a[model.operationArgumentIndex];
    const ctorDeclarations = [];
    const ctor = model.constructorArgumentIndexes.map((index) => {
      if (contract.arguments[index].type === 'integer-array') {
        if (language === 'cpp') return `std::vector<int>{${a[index].join(',')}}`;
        ctorDeclarations.push(`int32_t ctorData${index}[${Math.max(1, a[index].length)}]={${a[index].join(',')}};IntArray ctorArg${index}={ctorData${index},${a[index].length}};`);
        return `ctorArg${index}`;
      }
      return String(a[index]);
    }).join(',');
    const operation = model.scalarOperation;
    const call = language === 'c'
      ? `${model.native.cPrefix}${capitalize(operation.method)}(s,values[i])`
      : `s.${operation.method}(values[i])`;
    const emit = operation.resultType === 'number' ? `printf("%.17g",(double)${call});` : `printf("%d",(int)${call});`;
    if (language === 'c') return `${source}\n#include <stdio.h>\nint main(void){${ctorDeclarations.join('')}int32_t values[${Math.max(1, values.length)}]={${values.join(',')}};${model.className}*s=${model.native.cFactory}(${ctor});printf("${RESULT_PREFIX}{\\\"value\\\":[");for(size_t i=0;i<${values.length};i++){if(i)putchar(',');${emit}}${model.native.cDestructor ? `${model.native.cDestructor}(s);` : ''}printf("]}\\n");return 0;}`;
    return `${source}\n#include <cstdio>\n#include <vector>\nint main(){int values[${Math.max(1, values.length)}]={${values.join(',')}};${model.className} s${ctor ? `(${ctor})` : '{}'};printf("${RESULT_PREFIX}{\\\"value\\\":[");for(size_t i=0;i<${values.length};i++){if(i)putchar(',');${emit}}printf("]}\\n");return 0;}`;
  }
  const rows = a[model.operationArgumentIndex];
  const ctor = model.constructorArgumentIndexes.map((index) => String(a[index])).join(',');
  const declarations = [];
  let argumentSerial = 0;
  const literal = (value, type) => {
    const serial = argumentSerial++;
    if (type === 'string') {
      if (language === 'cpp') return `std::string{${nativeStringLiteral(value)}}`;
      declarations.push(`unsigned char statefulString${serial}[]=${nativeStringLiteral(value)};ByteString statefulArg${serial}={statefulString${serial},sizeof(statefulString${serial})-1};`);
      return `statefulArg${serial}`;
    }
    if (type === 'integer-array') {
      if (language === 'cpp') return `std::vector<int>{${value.join(',')}}`;
      declarations.push(`int32_t statefulData${serial}[${Math.max(1, value.length)}]={${value.join(',')}};IntArray statefulArg${serial}={statefulData${serial},${value.length}};`);
      return `statefulArg${serial}`;
    }
    return String(type === 'integer' ? Number(value) : value);
  };
  let collected = 0;
  const calls = rows.map((row) => {
    const operation = model.operations[String(row[0])];
    if (!operation) throw new Error(`Unknown stateful operation ${row[0]}.`);
    const args = operation.argumentIndexes.map((at, index) => {
      const type = operation.argumentTypes[index] ?? (Array.isArray(at) ? 'integer-array' : 'integer');
      const value = Array.isArray(at) ? at.map((position) => Number(row[position])) : row[at];
      return literal(value, type);
    });
    const call = language === 'c'
      ? `${model.native.cPrefix}${capitalize(operation.method)}(s${args.length ? `,${args.join(',')}` : ''})`
      : `s.${operation.method}(${args.join(',')})`;
    if (!operation.collect) return `${call};`;
    const comma = collected++ ? `putchar(',');` : '';
    if (operation.resultType === 'number') return `${comma}printf("%.17g",(double)${call});`;
    if (operation.resultType === 'string') return language === 'cpp'
      ? `${comma}{auto result=${call};__p_str((const unsigned char*)result.data(),result.size());}`
      : `${comma}{ByteString result=${call};__p_str(result.data,result.len);}`;
    if (operation.resultType === 'integer-array') return language === 'cpp'
      ? `${comma}{auto result=${call};putchar('[');for(size_t j=0;j<result.size();j++){if(j)putchar(',');printf("%d",result[j]);}putchar(']');}`
      : `${comma}{IntArray result=${call};__p_arr(result.data,result.len);}`;
    return `${comma}printf("%d",(int)${call});`;
  }).join('');
  const helpers = `static void __p_str(const unsigned char*s,size_t n){putchar('"');for(size_t i=0;i<n;i++){unsigned char c=s[i];if(c=='"'||c=='\\\\'){putchar('\\\\');putchar(c);}else putchar(c);}putchar('"');}static void __p_arr(const int32_t*a,size_t n){putchar('[');for(size_t i=0;i<n;i++){if(i)putchar(',');printf("%d",(int)a[i]);}putchar(']');}`;
  if (language === 'c') {
    const destroy = model.native.cDestructor ? `${model.native.cDestructor}(s);` : '';
    return `${source}\n#include <stdio.h>\n${helpers}\nint main(void){${declarations.join('')}${model.className}*s=${model.native.cFactory}(${ctor});printf("${RESULT_PREFIX}{\\\"value\\\":[");${calls}${destroy}printf("]}\\n");return 0;}`;
  }
  return `${source}\n#include <cstdio>\n#include <string>\n#include <vector>\n${helpers}\nint main(){${model.className} s${ctor ? `(${ctor})` : '{}'};printf("${RESULT_PREFIX}{\\\"value\\\":[");${calls}printf("]}\\n");return 0;}`;
}

// Q250 trees use canonical compact level-order notation: null slots do not
// reserve descendants.  Generate the corresponding real-node links without
// relying on heap-array indexes.
function levelOrderTreeLinks(values, name) {
  const links = [];
  const queue = values.length && values[0] !== null ? [0] : [];
  let cursor = 1;
  while (queue.length && cursor < values.length) {
    const parent = queue.shift();
    for (const field of ['left', 'right']) {
      if (cursor >= values.length) break;
      const child = cursor++;
      if (values[child] !== null) {
        links.push(`${name}[${parent}].${field}=&${name}[${child}];`);
        queue.push(child);
      } else links.push(`${name}[${parent}].${field}=NULL;`);
    }
  }
  return links.join('');
}

function nativeLinkedListHarness(language, source, contract, fixture) {
  const a = fixture.arguments;
  const declarations = [`void*original[${limitFor(fixture)}];size_t originalCount=0;`];
  const names = contract.arguments.map(({ type }, index) => {
    if (type === 'linked-list' || type === 'cyclic-linked-list') {
      const values = a[index];
      declarations.push(`ListNode n${index}[${Math.max(1, values.length)}]={0};`);
      values.forEach((value, i) => declarations.push(`n${index}[${i}].val=${value};n${index}[${i}].next=${i + 1 < values.length ? `&n${index}[${i + 1}]` : 'NULL'};original[originalCount++]=&n${index}[${i}];`));
      if (type === 'cyclic-linked-list' && values.length && a[index + 1] >= 0) declarations.push(`n${index}[${values.length - 1}].next=&n${index}[${a[index + 1]}];`);
      return values.length ? `&n${index}[0]` : 'NULL';
    }
    if (type === 'random-linked-list') {
      const rows = a[index];
      declarations.push(`RandomNode n${index}[${Math.max(1, rows.length)}]={0};`);
      rows.forEach((row, i) => declarations.push(`n${index}[${i}].val=${row[0]};n${index}[${i}].next=${i + 1 < rows.length ? `&n${index}[${i + 1}]` : 'NULL'};n${index}[${i}].random=${row[1] < 0 ? 'NULL' : `&n${index}[${row[1]}]`};original[originalCount++]=&n${index}[${i}];`));
      return rows.length ? `&n${index}[0]` : 'NULL';
    }
    if (type === 'linked-list-array') {
      const rows = a[index];
      rows.forEach((values, row) => {
        declarations.push(`ListNode n${index}_${row}[${Math.max(1, values.length)}]={0};`);
        values.forEach((value, i) => declarations.push(`n${index}_${row}[${i}].val=${value};n${index}_${row}[${i}].next=${i + 1 < values.length ? `&n${index}_${row}[${i + 1}]` : 'NULL'};original[originalCount++]=&n${index}_${row}[${i}];`));
      });
      declarations.push(`ListNode*arg${index}[${Math.max(1, rows.length)}]={${rows.length ? rows.map((values, row) => values.length ? `&n${index}_${row}[0]` : 'NULL').join(',') : 'NULL'}};`);
      return `arg${index}`;
    }
    return String(a[index]);
  });
  let callArgs = callableIndexes(contract).map((index) => names[index]);
  const arrayIndex = contract.arguments.findIndex(({ type }) => type === 'linked-list-array');
  if (arrayIndex >= 0) callArgs = [`arg${arrayIndex}`, String(a[arrayIndex].length)];
  const call = `${contract.callable.name}(${callArgs.join(',')})`;
  const limit = limitFor(fixture);
  if (contract.resultSource.kind === 'return-value') return `${source}\n#include <stdio.h>\nint main(void){${declarations.join('')}${contract.returns.type === 'boolean' ? 'bool' : 'int'} value=${call};printf("${RESULT_PREFIX}{\\\"value\\\":${contract.returns.type === 'boolean' ? '%s' : '%d'}}\\n",${contract.returns.type === 'boolean' ? 'value?"true":"false"' : 'value'});return 0;}`;
  const result = contract.resultSource.kind === 'mutated-argument' ? `${call};ListNode*result=${names[contract.resultSource.argumentIndex]};` : `${contract.includeRandom ? 'RandomNode' : 'ListNode'}*result=${call};`;
  const random = contract.includeRandom ? `RandomNode*nodes[${limit}];while(result&&count<${limit}){for(size_t i=0;i<count;i++)if(nodes[i]==result)return 2;nodes[count++]=result;result=result->next;}printf("${RESULT_PREFIX}{\\\"value\\\":[");for(size_t i=0;i<count;i++){if(i)putchar(',');int ri=-1;if(nodes[i]->random){ri=-2;for(size_t j=0;j<count;j++)if(nodes[j]==nodes[i]->random)ri=(int)j;if(ri<0)return 2;}printf("[%d,%d]",(int)nodes[i]->val,ri);}printf("]}\\n");`
    : `ListNode*nodes[${limit}];while(result&&count<${limit}){for(size_t i=0;i<count;i++)if(nodes[i]==result)return 2;nodes[count++]=result;result=result->next;}if(result)return 2;printf("${RESULT_PREFIX}{\\\"value\\\":[");for(size_t i=0;i<count;i++){if(i)putchar(',');printf("%d",(int)nodes[i]->val);}printf("]}\\n");`;
  const identity = `size_t reused=0;for(size_t i=0;i<count;i++)for(size_t j=0;j<originalCount;j++)if((void*)nodes[i]==original[j])reused++;${contract.identityPolicy === 'reuse-input-nodes' ? 'if(reused!=count)return 2;' : ''}${['allocate-new-list', 'no-original-node-reuse'].includes(contract.identityPolicy) ? 'if(reused)return 2;' : ''}`;
  return `${source}\n#include <stdio.h>\nint main(void){${declarations.join('')}${result}size_t count=0;${random}${identity}return 0;}`;
}

const jsonStringPrinter = `static void __p_str(const unsigned char*s,size_t n){putchar('"');for(size_t i=0;i<n;i++){unsigned char c=s[i];if(c=='"'||c=='\\\\'){putchar('\\\\');putchar(c);}else if(c=='\\n')fputs("\\\\n",stdout);else if(c=='\\r')fputs("\\\\r",stdout);else if(c=='\\t')fputs("\\\\t",stdout);else if(c<32)printf("\\\\u%04x",(unsigned)c);else putchar(c);}putchar('"');}`;

function common(source) {
  return `${source}\n#include <stdio.h>\nstatic void __p_arr(const int32_t*a,size_t n){putchar('[');for(size_t i=0;i<n;i++){if(i)putchar(',');printf("%d",(int)a[i]);}putchar(']');}\nstatic void __p_mat(const IntArray*a,size_t n){putchar('[');for(size_t i=0;i<n;i++){if(i)putchar(',');__p_arr(a[i].data,a[i].len);}putchar(']');}\n`;
}

function nativeTreeHarness(language, source, contract, fixture) {
  const a = fixture.arguments;
  const limit = limitFor(fixture);
  const declarations = [`TreeNode*original[${limit}];size_t originalCount=0;`];
  const names = contract.arguments.map(({ type }, index) => {
    if (['binary-tree', 'bst', 'tree', 'level-order-tree'].includes(type)) {
      const values = a[index];
      declarations.push(`TreeNode n${index}[${Math.max(1, values.length)}]={0};`);
      values.forEach((value, i) => { if (value !== null) declarations.push(`n${index}[${i}].val=${value};original[originalCount++]=&n${index}[${i}];`); });
      declarations.push(levelOrderTreeLinks(values, `n${index}`));
      return values.length && values[0] !== null ? `&n${index}[0]` : 'NULL';
    }
    if (type === 'integer-array') {
      declarations.push(`int32_t d${index}[]=${arr(a[index])};IntArray a${index}={d${index},${a[index].length}};`);
      return `a${index}`;
    }
    if (type === 'tree-node-reference') {
      const selector = contract.nodeReferenceArguments?.[index] ?? {};
      const rootIndex = selector.rootArgumentIndex ?? 0;
      const matches = (a[rootIndex] ?? []).flatMap((value, nodeIndex) => value === a[index] ? [nodeIndex] : []);
      if (selector.selector !== 'value' || (selector.requireUnique && matches.length !== 1)) throw new Error(`Tree node selector ${index} did not resolve uniquely.`);
      return matches.length ? `&n${rootIndex}[${matches[0]}]` : 'NULL';
    }
    return String(a[index]);
  });
  const directCall = `${contract.callable.name}(${callableIndexes(contract).map((index) => names[index]).join(',')})`;
  const call = contract.resultSource?.kind === 'codec-round-trip'
    ? `${contract.resultSource.decode}(${contract.resultSource.encode}(${callableIndexes(contract).map((index) => names[index]).join(',')}))`
    : directCall;
  const type = contract.returns.type;
  const returnsTree = ['level-order-tree', 'returned-tree', 'returned-subtree'].includes(type);
  const returnsNode = type === 'returned-node';
  const include = language === 'cpp' ? '#include <cstdio>\n#include <cstdint>\n#include <vector>' : '#include <stdio.h>\n#include <stdint.h>\n#include <stdbool.h>';
  const prefix = `printf("${RESULT_PREFIX}{\\\"value\\\":");`;
  if (returnsTree) {
    const result = contract.resultSource?.kind === 'mutated-argument' ? `${call};TreeNode*result=${names[contract.resultSource.argumentIndex]};` : `TreeNode*result=${call};`;
    return `${source}\n${include}\nint main(void){${declarations.join('')}${result}TreeNode*q[${limit}],*seen[${limit}];int32_t values[${limit}];unsigned char present[${limit}]={0};size_t h=0,t=0,s=0,last=0;if(result)q[t++]=result;while(h<t&&h<${limit}){TreeNode*n=q[h++];if(!n)continue;for(size_t i=0;i<s;i++)if(seen[i]==n){fprintf(stderr,"Cyclic or shared tree output");return 2;}seen[s++]=n;values[h-1]=n->val;present[h-1]=1;last=h;if(t+2>${limit})return 2;q[t++]=n->left;q[t++]=n->right;}if(h<t)return 2;${prefix}putchar('[');for(size_t i=0;i<last;i++){if(i)putchar(',');if(present[i])printf("%d",(int)values[i]);else fputs("null",stdout);}putchar(']');printf("}\\n");return 0;}`;
  }
  if (returnsNode) {
    return `${source}\n${include}\nint main(void){${declarations.join('')}TreeNode*value=${call};if(value){bool found=false;for(size_t i=0;i<originalCount;i++)if(original[i]==value)found=true;if(!found){fprintf(stderr,"Returned tree node is not an original fixture node");return 2;}}${prefix}if(value)printf("%d",(int)value->val);else fputs("null",stdout);printf("}\\n");return 0;}`;
  }
  const valueType = language === 'cpp' ? 'auto' : type === 'boolean' ? 'bool' : type === 'integer-array' ? 'IntArray' : type === 'integer-matrix' ? 'IntMatrix' : 'int32_t';
  const output = type === 'boolean' ? 'printf("%s",value?"true":"false");'
    : type === 'integer-array' ? `putchar('[');for(size_t i=0;i<value.len;i++){if(i)putchar(',');printf("%d",(int)value.data[i]);}putchar(']');`
      : type === 'integer-matrix' ? `putchar('[');for(size_t i=0;i<value.len;i++){if(i)putchar(',');putchar('[');for(size_t j=0;j<value.data[i].len;j++){if(j)putchar(',');printf("%d",(int)value.data[i].data[j]);}putchar(']');}putchar(']');`
        : 'printf("%d",(int)value);';
  const matrixPrinter = '';
  return `${source}\n${include}\n${matrixPrinter}\nint main(void){${declarations.join('')}${valueType} value=${call};${prefix}${output}printf("}\\n");return 0;}`;
}

function nativeQuadTreeHarness(language, source, contract, fixture) {
  const grid = fixture.arguments[0];
  const limit = limitFor(fixture);
  const include = language === 'cpp' ? '#include <cstdio>\n#include <vector>' : '#include <stdio.h>';
  let setup;
  let argument;
  if (language === 'cpp') {
    setup = '';
    argument = cppIntMatrix(grid);
  } else {
    const rows = grid.map((row, index) => `int32_t row${index}[]={${row.join(',')}};`).join('');
    setup = `${rows}IntArray rows[]={${grid.map((row, index) => `{row${index},${row.length}}`).join(',')}};IntMatrix grid={rows,${grid.length}};`;
    argument = 'grid';
  }
  return `${source}\n${include}\nint main(void){${setup}QuadNode*root=${contract.callable.name}(${argument});QuadNode*nodes[${limit}],*seen[${limit}];size_t paths[${limit}],depths[${limit}],count=0;size_t pendingCount=0;if(root){nodes[pendingCount]=root;paths[pendingCount]=1;depths[pendingCount++]=0;}printf("${RESULT_PREFIX}{\\\"value\\\":[");while(pendingCount){QuadNode*n=nodes[--pendingCount];size_t path=paths[pendingCount],depth=depths[pendingCount];for(size_t i=0;i<count;i++)if(seen[i]==n)return 2;if(depth>16||count>=${limit})return 2;seen[count]=n;QuadNode*c[4]={n->topLeft,n->topRight,n->bottomLeft,n->bottomRight};if(n->isLeaf){for(int i=0;i<4;i++)if(c[i])return 2;}else for(int i=0;i<4;i++)if(!c[i])return 2;if(count++)putchar(',');printf("[%zu,%d,%d]",path,n->isLeaf?1:0,n->val?1:0);if(!n->isLeaf)for(int slot=3;slot>=0;slot--){if(pendingCount>=${limit})return 2;nodes[pendingCount]=c[slot];paths[pendingCount]=path*4+(size_t)slot;depths[pendingCount++]=depth+1;}}printf("]}\\n");return 0;}`;
}

export function createNativeFamilyHarness({ language, source, contract, fixture }) {
  if (language !== 'c' && language !== 'cpp') return null;
  const a = fixture.arguments;
  const prefix = `printf("${RESULT_PREFIX}{\\\"value\\\":");`;
  const suffix = `printf("}\\n");return 0;`;
  if (['plain-return', 'semantic-collection'].includes(contract.adapter) && !['BLIND150-001', 'BLIND150-003'].includes(contract.questionId)) {
    const declarations = [];
    const argumentsList = contract.arguments.map(({ type }, index) => {
      if (type === 'integer-array') {
        declarations.push(`int32_t d${index}[]=${arr(a[index])};IntArray a${index}={d${index},${a[index].length}};`);
        return language === 'cpp' ? `std::vector<int>{${a[index].join(',')}}` : `a${index}`;
      }
      if (type === 'number-array') {
        if (language === 'cpp') return cppNumberArray(a[index]);
        declarations.push(`double d${index}[]=${arr(a[index])};Numbers a${index}={d${index},${a[index].length}};`);
        return `a${index}`;
      }
      if (type === 'integer-matrix') {
        if (language === 'cpp') return cppIntMatrix(a[index]);
        a[index].forEach((row, rowIndex) => declarations.push(`int32_t d${index}_${rowIndex}[]=${arr(row)};`));
        declarations.push(`IntArray r${index}[]={${a[index].length ? a[index].map((row, rowIndex) => `{d${index}_${rowIndex},${row.length}}`).join(',') : '{NULL,0}'}};IntMatrix a${index}={r${index},${a[index].length}};`);
        return `a${index}`;
      }
      if (type === 'string') {
        if (language === 'c') {
          const literal = nativeStringLiteral(a[index]);
          declarations.push(`unsigned char s${index}[]=${literal};ByteString a${index}={s${index},sizeof(s${index})-1};`);
          return `a${index}`;
        }
        return `std::string{${nativeStringLiteral(a[index])}}`;
      }
      if (type === 'string-array') {
        if (language === 'cpp') return cppStringArray(a[index]);
        a[index].forEach((value, itemIndex) => declarations.push(`unsigned char s${index}_${itemIndex}[]=${nativeStringLiteral(value)};`));
        declarations.push(`ByteString r${index}[]={${a[index].length ? a[index].map((value, itemIndex) => `{s${index}_${itemIndex},sizeof(s${index}_${itemIndex})-1}`).join(',') : '{NULL,0}'}};StringArray a${index}={r${index},${a[index].length}};`);
        return `a${index}`;
      }
      if (type === 'string-matrix') {
        if (language === 'cpp') return cppStringMatrix(a[index]);
        a[index].forEach((row, rowIndex) => {
          row.forEach((value, itemIndex) => declarations.push(`unsigned char s${index}_${rowIndex}_${itemIndex}[]=${nativeStringLiteral(value)};`));
          declarations.push(`ByteString b${index}_${rowIndex}[]={${row.length ? row.map((value, itemIndex) => `{s${index}_${rowIndex}_${itemIndex},sizeof(s${index}_${rowIndex}_${itemIndex})-1}`).join(',') : '{NULL,0}'}};`);
        });
        declarations.push(`StringArray r${index}[]={${a[index].length ? a[index].map((row, rowIndex) => `{b${index}_${rowIndex},${row.length}}`).join(',') : '{NULL,0}'}};StringMatrix a${index}={r${index},${a[index].length}};`);
        return `a${index}`;
      }
      return String(a[index]);
    });
    const output = contract.returns.type === 'boolean'
      ? `printf("%s",v?"true":"false");`
      : contract.returns.type === 'integer-array'
        ? (language === 'cpp'
          ? `putchar('[');for(size_t i=0;i<v.size();i++){if(i)putchar(',');printf("%d",v[i]);}putchar(']');`
          : `__p_arr(v.data,v.len);`)
        : contract.returns.type === 'number-array'
          ? (language === 'cpp'
            ? `putchar('[');for(size_t i=0;i<v.size();i++){if(i)putchar(',');printf("%.17g",v[i]);}putchar(']');`
            : `__p_num(v.data,v.len);`)
        : contract.returns.type === 'integer-matrix'
          ? (language === 'cpp'
            ? `putchar('[');for(size_t i=0;i<v.size();i++){if(i)putchar(',');putchar('[');for(size_t j=0;j<v[i].size();j++){if(j)putchar(',');printf("%d",v[i][j]);}putchar(']');}putchar(']');`
            : `__p_mat(v.data,v.len);`)
        : contract.returns.type === 'string'
          ? (language === 'cpp' ? `__p_str((const unsigned char*)v.data(),v.size());` : `__p_str(v.data,v.len);`)
        : contract.returns.type === 'string-array'
          ? (language === 'cpp'
            ? `putchar('[');for(size_t i=0;i<v.size();i++){if(i)putchar(',');__p_str((const unsigned char*)v[i].data(),v[i].size());}putchar(']');`
            : `__p_sarr(v.data,v.len);`)
        : contract.returns.type === 'string-matrix'
          ? (language === 'cpp'
            ? `putchar('[');for(size_t i=0;i<v.size();i++){if(i)putchar(',');putchar('[');for(size_t j=0;j<v[i].size();j++){if(j)putchar(',');__p_str((const unsigned char*)v[i][j].data(),v[i][j].size());}putchar(']');}putchar(']');`
            : `__p_smat(v.data,v.len);`)
        : contract.returns.type === 'number'
          ? `printf("%.17g",(double)v);`
        : `printf("%d",(int)v);`;
    const include = language === 'cpp' ? '#include <cstdio>\n#include <string>\n#include <vector>' : '#include <stdio.h>\n#include <stdint.h>';
    const valueType = language === 'cpp'
      ? 'auto'
      : contract.returns.type === 'boolean'
        ? 'bool'
        : contract.returns.type === 'integer-array'
          ? 'IntArray'
          : contract.returns.type === 'number-array'
            ? 'Numbers'
          : contract.returns.type === 'integer-matrix'
            ? 'IntMatrix'
          : contract.returns.type === 'string'
            ? 'ByteString'
          : contract.returns.type === 'string-array'
            ? 'StringArray'
          : contract.returns.type === 'string-matrix'
            ? 'StringMatrix'
          : contract.returns.type === 'number'
            ? 'double'
          : 'int32_t';
    const serializer = `${language === 'c' && ['integer-array', 'integer-matrix'].includes(contract.returns.type)
      ? `\nstatic void __p_arr(const int32_t*a,size_t n){putchar('[');for(size_t i=0;i<n;i++){if(i)putchar(',');printf("%d",(int)a[i]);}putchar(']');}`
      : ''}${language === 'c' && contract.returns.type === 'number-array' ? `\nstatic void __p_num(const double*a,size_t n){putchar('[');for(size_t i=0;i<n;i++){if(i)putchar(',');printf("%.17g",a[i]);}putchar(']');}` : ''}${language === 'c' && contract.returns.type === 'integer-matrix' ? `\nstatic void __p_mat(const IntArray*a,size_t n){putchar('[');for(size_t i=0;i<n;i++){if(i)putchar(',');__p_arr(a[i].data,a[i].len);}putchar(']');}` : ''}${['string', 'string-array', 'string-matrix'].includes(contract.returns.type) ? `\n${jsonStringPrinter}` : ''}${language === 'c' && ['string-array', 'string-matrix'].includes(contract.returns.type) ? `\nstatic void __p_sarr(const ByteString*a,size_t n){putchar('[');for(size_t i=0;i<n;i++){if(i)putchar(',');__p_str(a[i].data,a[i].len);}putchar(']');}` : ''}${language === 'c' && contract.returns.type === 'string-matrix' ? `\nstatic void __p_smat(const StringArray*a,size_t n){putchar('[');for(size_t i=0;i<n;i++){if(i)putchar(',');__p_sarr(a[i].data,a[i].len);}putchar(']');}` : ''}`;
    return `${source}\n${include}${serializer}\nint main(void){${language === 'c' ? declarations.join('') : ''}${valueType} v=${contract.callable.name}(${argumentsList.join(',')});${prefix}${output}${suffix}}`;
  }
  if (language === 'cpp' && contract.questionId === 'BLIND150-003') return `${source}\n#include <cstdio>\nint main(){auto v=twoSum(std::vector<int>{${a[0].join(',')}},${a[1]});printf("${RESULT_PREFIX}{\\\"value\\\":[");for(size_t i=0;i<v.size();i++){if(i)putchar(',');printf("%d",v[i]);}printf("]}\\n");return 0;}`;
  if (language === 'cpp' && contract.questionId === 'BLIND150-067') return `${source}\n#include <cstdio>\nint main(){auto v=subsets(std::vector<int>{${a[0].join(',')}});printf("${RESULT_PREFIX}{\\\"value\\\":[");for(size_t i=0;i<v.size();i++){if(i)putchar(',');putchar('[');for(size_t j=0;j<v[i].size();j++){if(j)putchar(',');printf("%d",v[i][j]);}putchar(']');}printf("]}\\n");return 0;}`;
  if (contract.questionId === 'BLIND150-003') return `${common(source)}int main(void){int32_t d[]=${arr(a[0])};IntArray nums={d,${a[0].length}};IntArray v=twoSum(nums,${a[1]});${prefix}__p_arr(v.data,v.len);${suffix}}`;
  if (contract.questionId === 'BLIND150-067') return `${common(source)}int main(void){int32_t d[]=${arr(a[0])};IntArray nums={d,${a[0].length}};IntMatrix v=subsets(nums);${prefix}__p_mat(v.data,v.len);${suffix}}`;
  if (contract.adapter === 'valid-prefix-mutation') {
    const extras = contract.arguments.slice(1).map((_, index) => String(a[index + 1]));
    if (language === 'cpp') return `${source}\n#include <cstdio>\nint main(){std::vector<int>v{${a[0].join(',')}};int k=${contract.callable.name}(v${extras.length ? ',' : ''}${extras.join(',')});${prefix}printf("[%d",k);if(k>=0&&(size_t)k<=v.size())for(int i=0;i<k;i++)printf(",%d",v[i]);putchar(']');${suffix}}`;
    return `${common(source)}int main(void){int32_t data[]=${arr(a[0])};IntArray v={data,${a[0].length}};int32_t k=${contract.callable.name}(v${extras.length ? ',' : ''}${extras.join(',')});${prefix}printf("[%d",(int)k);if(k>=0&&(size_t)k<=v.len)for(int32_t i=0;i<k;i++)printf(",%d",(int)v.data[i]);putchar(']');${suffix}}`;
  }
  if (contract.adapter === 'mutation') {
    const declarations = [];
    const names = contract.arguments.map(({ type }, index) => {
      if (type === 'integer-array') {
        if (language === 'cpp') return `a${index}`;
        declarations.push(`int32_t d${index}[]=${arr(a[index])};IntArray a${index}={d${index},${a[index].length}};`);
        return `a${index}`;
      }
      if (type === 'string-array') {
        if (language === 'cpp') return `a${index}`;
        a[index].forEach((value, item) => declarations.push(`unsigned char s${index}_${item}[]=${nativeStringLiteral(value)};`));
        declarations.push(`ByteString d${index}[]={${a[index].length ? a[index].map((value, item) => `{s${index}_${item},sizeof(s${index}_${item})-1}`).join(',') : '{NULL,0}'}};StringArray a${index}={d${index},${a[index].length}};`);
        return `a${index}`;
      }
      return String(a[index]);
    });
    if (language === 'cpp') {
      const setup = contract.arguments.map(({ type }, index) => type === 'integer-array'
        ? `std::vector<int>a${index}{${a[index].join(',')}};`
        : type === 'string-array' ? `auto a${index}=${cppStringArray(a[index])};` : '').join('');
      const target = `a${contract.mutation.target}`;
      const print = contract.returns.type === 'string-array'
        ? `putchar('[');for(size_t i=0;i<${target}.size();i++){if(i)putchar(',');__p_str((const unsigned char*)${target}[i].data(),${target}[i].size());}putchar(']');`
        : `putchar('[');for(size_t i=0;i<${target}.size();i++){if(i)putchar(',');printf("%d",${target}[i]);}putchar(']');`;
      return `${source}\n#include <cstdio>\n${contract.returns.type === 'string-array' ? jsonStringPrinter : ''}\nint main(){${setup}${contract.callable.name}(${names.join(',')});${prefix}${print}${suffix}}`;
    }
    const target = `a${contract.mutation.target}`;
    const print = contract.returns.type === 'string-array' ? `__p_sarr(${target}.data,${target}.len);` : `__p_arr(${target}.data,${target}.len);`;
    return `${common(source)}${contract.returns.type === 'string-array' ? jsonStringPrinter + '\nstatic void __p_sarr(const ByteString*a,size_t n){putchar(\'[\');for(size_t i=0;i<n;i++){if(i)putchar(\',\');__p_str(a[i].data,a[i].len);}putchar(\']\');}' : ''}int main(void){${declarations.join('')}${contract.callable.name}(${names.join(',')});${prefix}${print}${suffix}}`;
  }
  if (contract.adapter === 'linked-list') {
    return nativeLinkedListHarness(language, source, contract, fixture);
  }
  if (contract.adapter === 'tree') return nativeTreeHarness(language, source, contract, fixture);
  if (contract.adapter === 'quad-tree') return nativeQuadTreeHarness(language, source, contract, fixture);
  if (contract.adapter === 'graph') {
    const n = a[0].length;
    const neighborArrays = a[0].map((row, i) => row.length ? `GraphNode*e${i}[] = {${row.map((v) => `&nodes[${v - 1}]`).join(',')}};` : '').join('');
    const assign = a[0].map((row, i) => `nodes[${i}].val=${i + 1};nodes[${i}].neighbors=${row.length ? `e${i}` : 'NULL'};nodes[${i}].degree=${row.length};`).join('');
    return `${source}\n#include <stdio.h>\nint main(void){GraphNode nodes[${Math.max(1, n)}]={0};${neighborArrays}${assign}GraphNode*original=${n ? '&nodes[0]' : 'NULL'};GraphNode*root=cloneGraph(original);if(original&&root==original){fprintf(stderr,"Graph result must be a clone");return 2;}GraphNode*q[${limitFor(fixture)}];GraphNode*by[${Math.max(1, n)}]={0};size_t h=0,t=0;if(root)q[t++]=root;while(h<t&&h<${limitFor(fixture)}){GraphNode*x=q[h++];if(x->val<1||x->val>${n})return 2;if(by[x->val-1])continue;by[x->val-1]=x;for(size_t j=0;j<x->degree&&t<${limitFor(fixture)};j++)q[t++]=x->neighbors[j];}printf("${RESULT_PREFIX}{\\\"value\\\":[");for(size_t i=0;i<${n};i++){if(i)putchar(',');putchar('[');if(by[i])for(size_t j=0;j<by[i]->degree;j++){if(j)putchar(',');printf("%d",(int)by[i]->neighbors[j]->val);}putchar(']');}printf("]}\\n");return 0;}`;
  }
  if (contract.adapter === 'stateful') {
    return nativeStatefulHarness(source, contract, fixture, language);
  }
  return null;
}
