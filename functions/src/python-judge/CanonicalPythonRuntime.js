export const CANONICAL_PYTHON_RUNTIME = Object.freeze({
  schemaVersion: 1,
  artifact: Object.freeze({
    projectId: 'mi-tutora-ai-val-260904-k7m3',
    bucket: 'mi-tutora-ai-val-260904-k7m3-judge-artifacts',
    object: 'python/firecracker-v1/sha256-2e831d37fdb716eb1d09e75878b7209f6eb051510c491041af10acb7ca5d0410/mitutora-python-firecracker-runtime.tar.zst',
    generation: '1788850718748121',
    sizeBytes: 162_352_997,
    sha256: '2e831d37fdb716eb1d09e75878b7209f6eb051510c491041af10acb7ca5d0410',
  }),
  firecrackerVersion: '1.16.1',
  pythonVersion: '3.14.0',
  guestKernelVersion: '6.18.44',
  kernelDigest: 'd0fa6b694b32c9d12c5b1575180c888d9c83ff8955d21fe74debb4fe4832db22',
  rootfsDigest: '290ebfaa470293ea9f156b83b0257fbf04e533d9d9d49a51c9785b4302aa33ec',
  runtimeDigest: '333b0f4ea024fff35bad974b89990e46f79a8eb19e8fe780963a6942b44d391a',
  harnessDigest: 'a5296f6fefa57123a456e37b131b37b333b05f9623be8b7f23722b1fd6e5e734',
});

export function canonicalPythonRuntimeImage() {
  return Object.freeze({
    digest: CANONICAL_PYTHON_RUNTIME.runtimeDigest,
    rootfsDigest: CANONICAL_PYTHON_RUNTIME.rootfsDigest,
    kernelDigest: CANONICAL_PYTHON_RUNTIME.kernelDigest,
    pythonVersion: CANONICAL_PYTHON_RUNTIME.pythonVersion,
    guestKernelVersion: CANONICAL_PYTHON_RUNTIME.guestKernelVersion,
    firecrackerVersion: CANONICAL_PYTHON_RUNTIME.firecrackerVersion,
  });
}
