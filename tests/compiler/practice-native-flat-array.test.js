import { describe, expect, it } from 'vitest';
import { createNativeFamilyHarness } from '../../src/compiler/function-mode/nativeFamilyHarness';
import { compareFunctionResult } from '../../src/compiler/function-mode/functionResultComparison';

const contract = {
  questionId: 'SYNTHETIC-FLAT-ARRAY',
  adapter: 'plain-return',
  callable: { name: 'identity' },
  arguments: [{ index: 0, type: 'integer-array' }],
  returns: { type: 'integer-array' },
};

describe('native flat-array return serialization', () => {
  for (const values of [[], [7], [3, 3, -2], [9, -1, 4, 0]]) {
    it(`generates bounded order-preserving C/C++ serialization for ${JSON.stringify(values)}`, () => {
      const fixture = { arguments: [values], expected: values };
      const c = createNativeFamilyHarness({ language: 'c', source: 'typedef struct{int32_t*data;size_t len;}IntArray; IntArray identity(IntArray a){return a;}', contract, fixture });
      const cpp = createNativeFamilyHarness({ language: 'cpp', source: '#include <vector>\nstd::vector<int> identity(std::vector<int> a){return a;}', contract, fixture });
      expect(c).toContain('__p_arr(v.data,v.len)');
      expect(c).toContain(`IntArray a0={d0,${values.length}}`);
      expect(cpp).toContain('for(size_t i=0;i<v.size();i++)');
      expect(cpp).toContain(`std::vector<int>{${values.join(',')}}`);
      expect(c).not.toContain('SYNTHETIC-FLAT-ARRAY');
      expect(cpp).not.toContain('SYNTHETIC-FLAT-ARRAY');
    });
  }

  it('keeps exact flat-array length, order, values, duplicates, and emptiness significant', () => {
    const exact = (actual, expected) => compareFunctionResult({ policy: 'exact', actual, expected, fixture: {} });
    expect(exact([], [])).toBe(true);
    expect(exact([3, 3, -2], [3, 3, -2])).toBe(true);
    expect(exact([3, -2], [3, 3, -2])).toBe(false);
    expect(exact([3, -2, 3], [3, 3, -2])).toBe(false);
    expect(exact([3, 3, -1], [3, 3, -2])).toBe(false);
    expect(exact(7, [7])).toBe(false);
  });
});
