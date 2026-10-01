# Browser security-header policy

The canonical policy is `config/securityHeaderPolicy.mjs`. Vercel production routes and the local Vite development/preview servers consume the same definitions. The learner JavaScript Worker retains its separate, stricter deny-network CSP from `config/javascriptLearnerWorkerPolicy.mjs`.

## Host and surface matrix

| Surface | COOP | COEP | CORP | Document policy |
| --- | --- | --- | --- | --- |
| `ycoders.com` and main-project previews | not set | not set | not set | common document headers |
| `compiler.ycoders.com`, `ycoders-compiler.vercel.app`, compiler preview aliases | `same-origin` | `require-corp` | `same-origin` | common document headers plus compiler isolation |
| `/api/**` | not added by the document policy | not added by the document policy | compiler host isolation route only | API MIME/referrer/permissions/HSTS subset; no document CSP |
| local Vite development and preview | `same-origin` | `require-corp` | `same-origin` | common document headers without HSTS |
| learner JavaScript Worker asset | inherited host isolation as applicable | inherited host isolation as applicable | inherited as applicable | strict Worker CSP with no network, nested workers, frames, or objects |

Host isolation remains hostname-scoped in production so main-site Firebase/Google popup behavior does not inherit compiler-only COOP/COEP. Compiler custom, stable Vercel, and preview aliases match the compiler host expression. Local development deliberately enables isolation on the single local origin because standalone and embedded runtime acceptance require `SharedArrayBuffer`.

## Common document policy

- `Content-Security-Policy`: enforces `base-uri 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, and a bounded form action policy.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy`: camera, microphone, fullscreen, and payment remain same-origin; geolocation, motion sensors, USB, serial, and Bluetooth are disabled.
- `Strict-Transport-Security: max-age=31536000` in Vercel production/preview responses. `includeSubDomains` and `preload` are intentionally omitted because every future subdomain has not been certified for those commitments.
- `X-Frame-Options: DENY` provides compatible defense in depth matching CSP `frame-ancestors 'none'`.

The API subset uses `nosniff`, `no-referrer`, a deny-by-default powerful-feature policy, and HSTS. It intentionally does not attach document CSP or frame policy to JSON responses and does not override endpoint-specific cache controls.

## CSP scope and measured exceptions

The enforced CSP is intentionally directive-specific and does not define `default-src`, `script-src`, `connect-src`, `worker-src`, or `style-src`. The application currently needs:

- Firebase Auth/Firestore/Functions endpoints, Google authentication, and WebSocket transports;
- Razorpay checkout from `https://checkout.razorpay.com`;
- Pyodide and MediaPipe assets from `https://cdn.jsdelivr.net`;
- MediaPipe models from `https://storage.googleapis.com`;
- same-origin module Workers, blob-backed runtime resources, WebAssembly, Monaco, PHP-WASM/WebR/.NET/TeaVM/native/Assembly assets;
- runtime code generation/evaluation required by specific compiler toolchains.

An unmeasured restrictive source-list CSP would either require global `unsafe-eval` allowances or break supported runtimes/authentication. Source directives should be tightened only after production CSP telemetry and runtime-by-runtime acceptance exist. The current enforced directives add meaningful injection/framing containment without claiming controls the browser cannot safely enforce yet.

The learner JavaScript/TypeScript capability boundary does not depend on the document CSP. Its emitted Worker response keeps the dedicated `connect-src 'none'` and `worker-src 'none'` policy in addition to the runtime capability membrane.

## Validation

Run:

```text
npm.cmd exec -- vitest run tests/compiler/compiler-vercel-routing.test.js tests/compiler/javascript-capability-boundary.test.js
npm.cmd run test:e2e -- tests/e2e/javascript-runtime-isolation.spec.js
npm.cmd run build
```

For local isolation, start the Vite browser-runtime harness and verify in Chromium:

```js
({ isolated: crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer })
```

Expected result is `{ isolated: true, sharedArrayBuffer: 'function' }` on the compiler/local isolated surface. Main production documents must not receive COOP or COEP.
