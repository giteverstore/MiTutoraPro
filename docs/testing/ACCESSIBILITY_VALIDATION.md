# Accessibility validation

## Scope and standard

Y Coders targets WCAG 2.1 AA for public, authentication, authenticated application, learning, project, exam, and standalone compiler experiences. Accessibility validation combines semantic review, automated axe scans in real Chromium, and keyboard-only checks. Automated scans are evidence, not a replacement for assistive-technology and visual review.

## Automated matrix

Run:

```powershell
npx.cmd playwright test tests/e2e/accessibility-matrix.spec.js --project=chromium
```

The matrix covers the landing page, sign-in, sign-up, public Library, public Practice, public Projects, standalone compiler, and authenticated Home, Library, Practice, Challenges, Projects, Bookmarks, Certificates, Referrals, Wallet, Redeem, and Settings routes. Critical and serious axe findings fail the suite. The browser test uses local content and Firebase Auth/Firestore emulators; it does not use production data.

## Keyboard matrix

The automated keyboard smoke verifies:

- Auth fields enter the tab order with visible native focus.
- Standalone compiler actions expose accessible names and keyboard focus.
- The authenticated shell exposes `Skip to main content` as its first focus target and moves focus to the main region.

Manual keyboard validation remains required for complete coverage:

1. Traverse every interactive control with Tab and Shift+Tab.
2. Activate buttons and links with Enter/Space as appropriate.
3. Open menus/dialogs; verify initial focus, contained focus, Escape close, and trigger focus restoration.
4. Operate tablists with the documented control keys and verify selected state.
5. Operate project splitters with arrow keys and confirm the announced value changes.
6. Confirm no keyboard trap exists in Monaco; use Monaco's documented escape command when leaving the editor.

## Responsive and zoom checks

At 320 CSS pixels and at 200% browser zoom, verify that primary actions, dialog controls, compiler controls, learning navigation, and project workspace controls remain reachable without two-dimensional page scrolling. Editor canvases may scroll internally. Repeat in light and dark themes, and with reduced motion enabled.

## Assistive technology checks

Before release, manually sample Chromium with NVDA or Narrator:

- Page title, primary heading, landmarks, navigation labels, and current location.
- Form label, required/error state, and error association.
- Dialog name, description, focus containment, close, and focus restoration.
- Live status/error announcements during compiler execution, validation, save, and asynchronous loading.
- Project tree, file tabs, result tabs, splitters, and Monaco editor label.

## Known boundaries

- Axe cannot prove logical focus order, useful alternative text, correct live-region timing, or full screen-reader usability.
- Monaco supplies its own accessible editor mode and keyboard model; application wrappers must retain a descriptive label and must not intercept its commands.
- Canvas/video exam checks need manual spoken-label and keyboard verification.
- Contrast must be rechecked whenever theme tokens or content artwork changes.

## Release gate

A release may be classified `ACCESSIBILITY_VALIDATION_COMPLETE` only when the required route matrix completes, has no critical/serious axe findings, keyboard checks pass, and manual exceptions are recorded. Otherwise classify it `ACCESSIBILITY_PARTIAL` and retain the remaining items as validation debt.

## Final coverage closure evidence — 2026-10-01

The original 18-route Chromium matrix remains the broad regression baseline. `tests/e2e/accessibility-closure.spec.js` adds real lesson, opened Project Workspace, dark-theme, mobile, tablet, 200%-reflow, and WCAG text-spacing coverage. Axe is configured for WCAG 2.1 A/AA and fails on critical or serious findings.

| Surface | Light | Dark | Keyboard | Mobile | 200% zoom | Axe | Screen-reader semantics | Known exception |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public/auth/AppShell routes | Passed | Representative routes passed | Skip link, auth, menus/dialog focus covered | Passed representative routes | Home/Practice/Settings passed | Passed | Names, roles, landmarks, dialog focus inspected | No actual AT run |
| Learning Engine lesson | Passed | Passed | Sidebar activation and completion controls reachable; compiler tab pattern repaired | Passed | Responsive lesson route inspected | Passed | Lesson progress is explicitly named `Lesson progress`; lesson region and controls expose roles/names | Quiz/exercise variants and full compiler execution were not available in the selected deterministic lesson |
| Opened Project Workspace | Passed | Passed | Guide/AI and Results arrow navigation; three splitters update values | Passed where supported | Responsive workspace inspected | Passed | Explorer tree, file toolbar, tablists, selected state, separators, and values inspected | Destructive file-operation focus flows were not exercised against persistent data |
| Standalone compiler | Passed | Passed | Language dialog Escape/focus return; result-tab structure repaired | Passed | Passed | Passed | Brand link, static file label, results tablist, terminal/log, and Input drawer semantics inspected | Actual compiler execution varies by runtime |
| Exam/setup | Component semantics only | Component semantics only | Component tests passed | Not reached | Not reached | Not reached in a live eligible flow | Source/component semantics inspected | Free emulator account has no eligible/premium certification state; no production data was created |

The text-spacing probe applies line-height 1.5, paragraph spacing 2em, letter spacing 0.12em, and word spacing 0.16em at runtime; it is not a permanent visual override. NVDA was not present on `PATH` or in the standard Program Files locations, so this evidence is semantic browser validation rather than manual assistive-technology certification.

Current classification: `ACCESSIBILITY_COVERAGE_PARTIALLY_VALIDATED`. The remaining blockers are a live eligible exam/setup journey, representative quiz/exercise lesson variants, destructive Project file-operation focus restoration, and an actual NVDA/Narrator session.
