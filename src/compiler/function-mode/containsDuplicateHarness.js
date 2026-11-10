import { createDynamicFamilyHarness } from './dynamicFamilyHarness';
import { createManagedFamilyHarness } from './managedFamilyHarness';
import { createNativeFamilyHarness } from './nativeFamilyHarness';

const RESULT_PREFIX = '__YCODERS_FUNCTION_RESULT__';

const literal = (value) => JSON.stringify(value);

const builders = Object.freeze({
  python: (source, args) => `${source}\n\nimport json as __yc_json\ntry:\n    __yc_value = containsDuplicate(${literal(args[0])})\n    print("${RESULT_PREFIX}" + __yc_json.dumps({"value": __yc_value}))\nexcept Exception as __yc_error:\n    raise __yc_error\n`,
  javascript: (source, args) => `${source}\n\nconsole.log("${RESULT_PREFIX}" + JSON.stringify({ value: containsDuplicate(${literal(args[0])}) }));\n`,
  typescript: (source, args) => `${source}\n\nconsole.log("${RESULT_PREFIX}" + JSON.stringify({ value: containsDuplicate(${literal(args[0])}) }));\n`,
  java: (source, args) => `${source}\n\nclass Main { public static void main(String[] args) { boolean value = new Solution().containsDuplicate(new int[]{${args[0].join(',')}}); System.out.println("${RESULT_PREFIX}" + "{\\\"value\\\":" + value + "}"); } }\n`,
  c: (source, args) => `${source}\n\n#include <stdio.h>\nint main(void) { int32_t __yc_data[] = {${args[0].join(',')}}; IntArray __yc_nums = { __yc_data, ${args[0].length} }; bool __yc_value = containsDuplicate(__yc_nums); printf("${RESULT_PREFIX}{\\\"value\\\":%s}\\n", __yc_value ? "true" : "false"); return 0; }\n`,
  cpp: (source, args) => `${source}\n\n#include <iostream>\nint main() { bool value = containsDuplicate(std::vector<int>{${args[0].join(',')}}); std::cout << "${RESULT_PREFIX}{\\\"value\\\":" << (value ? "true" : "false") << "}" << std::endl; return 0; }\n`,
  csharp: (source, args) => `${source}\n\npublic static class Program { public static void Main() { bool value = new Solution().containsDuplicate(new int[]{${args[0].join(',')}}); System.Console.WriteLine("${RESULT_PREFIX}" + (value ? "{\\\"value\\\":true}" : "{\\\"value\\\":false}")); } }\n`,
  php: (source, args) => `${source.replace(/\?>\s*$/, '')}\n\n$__yc_value = containsDuplicate(${literal(args[0])});\necho '${RESULT_PREFIX}' . json_encode(['value' => $__yc_value]) . PHP_EOL;\n`,
  r: (source, args) => `${source}\n\n.__yc_value <- containsDuplicate(c(${args[0].join(',')}))\ncat('${RESULT_PREFIX}', if (isTRUE(.__yc_value)) '{"value":true}' else '{"value":false}', '\\n', sep='')\n`,
});

export function createContainsDuplicateHarness({ language, source, fixture }) {
  const build = builders[language];
  if (!build) throw new Error(`No function adapter is available for "${language}".`);
  return build(String(source ?? ''), fixture.arguments ?? []);
}

export function createPracticeFunctionHarness({ language, source, fixture, contract }) {
  if (contract.questionId === 'BLIND150-001') return createContainsDuplicateHarness({ language, source, fixture });
  const generated = createDynamicFamilyHarness({ language, source, fixture, contract })
    ?? createManagedFamilyHarness({ language, source, fixture, contract })
    ?? createNativeFamilyHarness({ language, source, fixture, contract });
  if (!generated) throw new Error(`No ${contract.adapter} function adapter is available for "${language}".`);
  return generated;
}

export function parseFunctionHarnessResult(output) {
  const line = String(output ?? '').split(/\r?\n/).find((entry) => entry.startsWith(RESULT_PREFIX));
  if (!line) throw Object.assign(new Error('The function result could not be serialized.'), { code: 'FUNCTION_SERIALIZATION_ERROR' });
  try {
    const parsed = JSON.parse(line.slice(RESULT_PREFIX.length));
    if (!Object.prototype.hasOwnProperty.call(parsed ?? {}, 'value')) throw new Error('The function result did not include a value.');
    return parsed.value;
  } catch (error) {
    throw Object.assign(new Error(`The function result could not be serialized: ${error.message}`), { code: 'FUNCTION_SERIALIZATION_ERROR' });
  }
}

export { RESULT_PREFIX };
