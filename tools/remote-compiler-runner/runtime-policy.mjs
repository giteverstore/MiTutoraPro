export const RUNTIMES = Object.freeze({
  go: Object.freeze({ image: process.env.GO_RUNNER_IMAGE || 'ycoders/go-runner:1.27.1', fileName: 'main.go', toolchainVersion: 'go1.27.1' }),
  rust: Object.freeze({ image: process.env.RUST_RUNNER_IMAGE || 'ycoders/rust-runner:1.98.1', fileName: 'main.rs', toolchainVersion: 'rustc 1.98.1', edition: '2024' }),
});

export const CONTAINER_LIMITS = Object.freeze({ memory: '512m', memorySwap: '512m', cpus: '1', pids: '64', tempBytes: '192m', workspaceBytes: '96m', wallTimeoutMs: 30_000, outputBytes: 1024 * 1024 });
