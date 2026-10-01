# Stylesheet ownership

`design-system/tokens.css` owns global tokens. `design-system/primitives.css` owns reusable controls and cards. `design-system/coherence.css` owns cross-domain consistency rules.

Domain styles live in `src/styles/pages/` or the appropriate layout/component subdirectory and use that domain's class prefix. `src/styles/index.css` is the ordered foundation entrypoint; routes explicitly import their owned feature sheets. The former monolithic `src/styles.css` has been removed and must not be recreated.

Component state should use state/data attributes, not broad element selectors. A domain stylesheet must not target another domain's prefix. Compiler, Practice, learning, certification, settings, and shell prefixes are separate ownership boundaries.
