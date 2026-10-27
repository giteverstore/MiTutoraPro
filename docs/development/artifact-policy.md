# Repository artifact policy

This repository contains handwritten source, generated source, browser runtime distributions, build output, and local diagnostics. Keep those categories distinct so required runtime files remain reproducible without committing local noise.

## Handwritten source

Application, server, function, script, schema, test, and documentation source is reviewed and edited normally. Source files must not depend on ignored local build directories.

## Generated source

Generated source that is required by a build or runtime may be committed when its generator and authoritative inputs are versioned. Do not edit generated files manually; update their inputs and rerun the documented generator. `shared/content/generatedValidators.js` is one example.

## Committed runtime distributions

Browser runtimes under `public/` are production delivery artifacts and may be committed when the application serves them directly. Treat them as immutable generated distributions: rebuild from their source project, verify them with the relevant runtime tests, and update them deliberately.

The .NET browser distribution is served from `public/dotnet`. Its source project is `tools/dotnet-runtime`; intermediate `obj/` output is not authoritative. The tracked `tools/dotnet-runtime/bin/` tree remains under review until its publish-and-copy procedure is documented and reproducible.

## Rebuildable output and caches

Local test bundles, build directories, compiler intermediates, caches, coverage, and emulator output must not be committed. Examples include `dist/`, `.vite/`, `.tmp-monaco-lifecycle/`, `tools/dotnet-runtime/obj/`, and `test-results/`.

## Local diagnostics

Log files are local diagnostic output. They may contain machine paths, project identifiers, user identifiers, or email addresses, so they are ignored with `*.log` and must not be committed. Operational logging remains implemented in application/server code and is not covered by this rule.

## Files that must not be manually edited

- dependency lock files outside a dependency-management change;
- generated content validators;
- generated course/content payloads;
- browser runtime distributions and WASM binaries;
- compiler build output;
- emulator, Firebase, or debug logs.

Before removing or regenerating a committed runtime distribution, identify its source inputs and build command, verify that CI or a documented local process reproduces it, and run the strongest available runtime smoke tests.
