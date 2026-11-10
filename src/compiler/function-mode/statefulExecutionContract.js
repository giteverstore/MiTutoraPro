const freezeOperation = (operation) => Object.freeze({
  method: operation.method,
  argumentIndexes: Object.freeze((operation.argumentIndexes ?? []).map((index) => Array.isArray(index) ? Object.freeze([...index]) : index)),
  collect: operation.collect === true,
  resultType: operation.resultType ?? null,
  argumentTypes: Object.freeze(operation.argumentTypes ?? []),
});

export function createStatefulExecutionDefinition({
  className,
  constructorArgumentIndexes = [],
  operationArgumentIndex,
  scalarOperation = null,
  operations,
  native = {},
}) {
  if (!className || !Number.isInteger(operationArgumentIndex) || (!operations && !scalarOperation)) {
    throw new Error('Invalid stateful execution definition.');
  }
  return Object.freeze({
    className,
    constructorArgumentIndexes: Object.freeze([...constructorArgumentIndexes]),
    operationArgumentIndex,
    scalarOperation: scalarOperation ? freezeOperation(scalarOperation) : null,
    operations: Object.freeze(Object.fromEntries(
      Object.entries(operations ?? {}).map(([opcode, operation]) => [String(opcode), freezeOperation(operation)]),
    )),
    native: Object.freeze({ ...native }),
  });
}

export function assertStatefulExecutionDefinition(definition) {
  if (!definition?.className || !Number.isInteger(definition.operationArgumentIndex)) {
    throw new Error('Stateful contract requires a class and operation source.');
  }
  if (definition.scalarOperation && (!definition.scalarOperation.method || definition.scalarOperation.argumentIndexes.length)) {
    throw new Error('Scalar stateful operation requires one implicit stream value.');
  }
  for (const [opcode, operation] of Object.entries(definition.operations ?? {})) {
    if (!opcode || !operation.method || !Array.isArray(operation.argumentIndexes)
      || operation.argumentIndexes.some((index) => !Number.isInteger(index) && !Array.isArray(index))) {
      throw new Error(`Invalid stateful operation ${opcode}.`);
    }
  }
  return definition;
}
