import * as ort from 'onnxruntime-web/wasm';
import modelUrl from '@ricky0123/vad-web/dist/silero_vad_v5.onnx?url';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import wasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';

ort.env.wasm.wasmPaths = Object.freeze({
  wasm: wasmUrl,
  mjs: wasmModuleUrl,
});

export const sileroVadRuntime = Object.freeze({ ort, modelUrl, wasmUrl, wasmModuleUrl });
