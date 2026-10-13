# Error Handling and Recovery

ycoders uses layered React error boundaries so a render failure is contained at the smallest useful domain while preserving the learner's surrounding context.

- `GlobalErrorBoundary` protects application startup and provides a final recovery path.
- AppShell page boundaries keep shared navigation available when one page fails.
- Learning, compiler, Practice, Challenges, and exam boundaries isolate higher-risk content and runtime surfaces.

Recovery states use `ErrorState` with full-page, panel, and compact layouts. Render failures use semantic alerts, move focus to the recovery region, and offer a targeted retry plus an optional back action. A diagnostic ID helps correlate reports without exposing stack traces or implementation details. Static not-found and Coming Soon screens are not announced as alerts. Detailed error logging is development-only; existing typed service/content errors and user-facing async states remain responsible for non-render failures.

Error boundaries do not catch arbitrary event-handler or detached asynchronous errors. Those paths must reject with typed errors and surface their own actionable state.

## Learner-facing failure-state inventory

The table covers meaningful page and panel failures. Field validation, normal sign-in/Premium gates, compiler program output, and transient toasts remain in their owning surfaces rather than becoming page errors.

| Surface (owner) | Trigger and learner copy | Actions | Scope / reference |
| --- | --- | --- | --- |
| Application startup (`src/errors/ErrorBoundary.jsx`) | Uncaught render failure: “ycoders could not continue.” | Reload; try without reloading | Full / generated reference ID |
| AppShell pages (`src/App.jsx`) | Route render failure: page or Practice could not be displayed | Try again | Full within shell / generated reference ID |
| Course workspace (`src/App.jsx`) | Course render failure: workspace could not be displayed; saved progress unaffected | Try again; go back | Full within workspace / generated reference ID |
| Course loading (`src/components/CourseLoadState.jsx`) | Coming Soon, missing content, or technical load failure, differentiated by known content code | None (existing behavior) | Full / no reference |
| Course compiler block (`src/components/blocks/CompilerBlock.jsx`) | Render failure: code workspace could not be displayed | Try again | Panel / generated reference ID |
| Shared Practice/Challenge compiler (`src/components/SharedCompilerDock.jsx`) | Compiler render failure | Try again | Panel / generated reference ID |
| Project direct route (`src/projects/pages/ProjectsPage.jsx`) | Missing project or failed project load | Back to Projects | Full / no reference |
| Project catalog/resume (`src/projects/pages/ProjectsPage.jsx`) | Pinned version temporarily unavailable or catalog content error | Existing catalog navigation; no automatic retry | Compact within catalog / no reference |
| Practice initial catalog (`src/practice/PracticePage.jsx`) | Metadata query failure | Retry same page | Full / safe stage/code/category attributes, no reference ID |
| Practice question (`src/practice/PracticePage.jsx`) | Question load failure | Retry question; Back to Practice | Full / safe stage/code/category attributes, no reference ID |
| Practice subsequent page (`src/practice/PracticePage.jsx`) | Pagination load failure with existing cards retained | Retry page | Inline / no reference |
| Challenge hub (`src/challenges/ChallengesPage.jsx`) | Today's challenge load failed or no challenge available | Existing Challenge navigation | Inline / no reference |
| Dated Challenge workspace (`src/challenges/ChallengesPage.jsx`) | Challenge invalid, unavailable, or failed to load | Back to Challenges | Full / no reference |
| Certificates list (`src/certificates/CertificatesPage.jsx`) | Certificate read failure | None (existing behavior) | Panel / no reference |
| Public certificate verification (`src/certificates/PublicCertificateVerificationPage.jsx`) | Credential not found, revoked, or verification failed | None (existing behavior) | Full / no reference |
| Certification exam/setup (`src/App.jsx`) | Render failure in exam or setup verification | Try again; leave | Full / generated reference ID |
| Wallet (`src/wallet/WalletPage.jsx`) | Wallet/transaction read failure | None (existing behavior) | Full / no reference |
| Referrals (`src/referrals/ReferralsPage.jsx`) | Referral profile read failure | None (existing behavior) | Full / no reference |
| Home learning card (`src/home/HomeSections.jsx`) | Saved learning data unavailable | None (existing behavior) | Compact / no reference |
| Settings theme ownership (`src/settings/SettingsPage.jsx`) | Owned theme list unavailable; default remains usable | None (existing behavior) | Inline / no reference |
| AI Tutor response (`src/ai/AITutorPanel.jsx`, `src/ai/AITutorWorkspace.jsx`) | AI request unavailable or failed | Existing Retry explanation where supported; composer behavior unchanged | Compact within pane / no reference |
| Project AI conversation (`src/projects/components/ProjectContextualAIConversation.jsx`) | Mentor reply failed | Existing Retry within transcript | Conversation turn / no reference |
| Standalone compiler routing/share (`src/standalone-compiler/StandaloneCompilerApp.jsx`) | Unknown language or unavailable/expired share | View compilers for unknown language; none for expired share | Full / no reference |
| Standalone/embedded compiler execution (`src/standalone-compiler/StandaloneTerminalPanel.jsx`, result panels) | Learner compile/runtime/preview/database failure | Existing Run/reset/language controls | Output pane / compiler diagnostics stay visible |
| Public and authenticated unknown routes (`src/public/PublicBrowseApplication.jsx`, `src/App.jsx`) | Invalid route | Return home | Full within applicable shell / no reference |

The shared component changes presentation only. It does not infer retryability or create new retry controls. Existing program diagnostics and conversational messages remain inline because converting them to a full-page error would hide useful context or change the interaction model.
