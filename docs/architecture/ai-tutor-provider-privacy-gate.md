# AI Tutor Provider and Privacy Gate

**Review date:** 2026-08-29  
**Phase:** 4.5  
**Status:** COMPLETE AS A LOCAL REVIEW; NOT PRODUCTION APPROVAL

This document is the provider/privacy decision record for the first MiTutora Pro AI Tutor release. It is an engineering and product-risk review, not legal advice or a compliance claim. The active test configuration remains `huggingface` / `openai/gpt-oss-120b:fastest`; no provider, credential, billing, or production setting was changed in this phase.

## Decision summary

- **Production-provider candidate:** OpenAI.
- **Exact candidate model:** `gpt-5.4-mini-2026-03-17`.
- **Decision state:** RECOMMENDED. Exact-model evaluation, provider-account controls, legal/privacy approval, infrastructure, and rollout authorization remain pending.
- **Phase 4.1 consistency:** the recommendation remains internally consistent. Its criteria total 100%, the workload arithmetic remains correct, and current official documentation still supports the model's coding positioning, structured outputs, dated snapshot, context limits, and prices.
- **Material clarification:** India is documented as a data-residency storage region, not an inference-processing region. General availability, account eligibility, latency, contracting, and the intended regional route must be confirmed for the production account. This narrows the earlier broad “India fit” claim but does not currently change the recommendation.

## Evidence labels

Every provider-policy statement below uses one of these labels:

- **FACT:** directly supported by current official provider documentation.
- **PROVIDER CONFIRMATION REQUIRED:** depends on the selected account, contract, project configuration, endpoint, or undocumented implementation detail.
- **HUMAN/LEGAL REVIEW REQUIRED:** requires an organizational, product, privacy, or legal decision.

No finding in this document is a legal-compliance conclusion.

## Official OpenAI sources

- [GPT-5.4 Mini model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [API data controls and data residency](https://developers.openai.com/api/docs/guides/your-data)
- [Responses API create reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [OpenAI Services Agreement](https://openai.com/policies/services-agreement/)
- [OpenAI Service Terms](https://openai.com/policies/service-terms/)
- [OpenAI Data Processing Addendum](https://openai.com/policies/data-processing-addendum/)
- [OpenAI sub-processor list](https://openai.com/policies/sub-processor-list/)
- [OpenAI enterprise privacy and security](https://openai.com/enterprise-privacy/)

These sources are point-in-time evidence. The provider lifecycle policy below requires re-review before procurement and after material policy changes.

## Provider findings

| Topic | Finding | Classification | Release implication |
| --- | --- | --- | --- |
| Training use | API customer content is not used to develop or improve services unless the customer explicitly agrees. | FACT | Keep optional data sharing disabled; verify account settings. |
| Abuse monitoring | API abuse-monitoring logs may contain prompts/responses and are retained up to 30 days by default, subject to documented exceptions. | FACT | Default retention is not equivalent to ZDR. |
| Responses application state | `/v1/responses` has a 30-day application-state period by default; `store: false` prevents response retrieval storage, while abuse-monitoring rules still apply. | FACT | The adapter now explicitly sends `store: false`. |
| MAM/ZDR | Modified Abuse Monitoring and Zero Data Retention require OpenAI approval and additional requirements; project/org configuration controls apply. | FACT | Eligibility and exact project configuration must be confirmed. |
| Human review | Business data may be processed by automated safety classifiers; abuse-review access and exceptions remain configuration/policy dependent. | FACT / PROVIDER CONFIRMATION REQUIRED | Confirm the selected account's review and retention posture. |
| Regional storage | India is listed for regional storage, requires MAM or ZDR, and does not provide regional inference processing. | FACT | India-only processing cannot be claimed. |
| Regional inference | GPT-5.4 Mini Responses regional processing is documented in the United States and Europe; system data can be processed outside a chosen region. | FACT | Select and contract the intended region explicitly. |
| International transfers | The DPA describes processor roles and transfer mechanisms for covered EEA/Swiss/UK data; API sub-processors operate in multiple countries. | FACT | India and other launch-region transfer obligations require legal review. |
| Sub-processors | The current API list includes infrastructure, delivery, support, identity, warehousing, and moderation providers with published processing locations. | FACT | Subscribe to changes and review the actual production-account applicability. |
| Deletion | The DPA provides return/deletion after agreement expiry or termination, subject to legal retention. Per-request deletion of abuse logs is not established. | FACT / PROVIDER CONFIRMATION REQUIRED | Define offboarding and data-subject workflows with the provider. |
| Security | OpenAI documents SOC 2 review, AES-256 at rest, TLS 1.2+ in transit, access controls, and contractual security measures. | FACT | Obtain and review the applicable audit/security materials; documentation is not a MiTutora risk acceptance. |
| Terms | The Services Agreement requires rights to inputs, evaluation of output accuracy, necessary end-user consent, and parent/guardian consent for minors using the services. | FACT | Product/legal owners must define age and consent controls before enablement. |
| India availability | Official regional documentation supports an India storage endpoint, but this review does not establish the production account's commercial access, rate tier, latency, or intended contracting route. | PROVIDER CONFIRMATION REQUIRED | Confirm with the provider/account owner. |
| Reliability and limits | Model rate limits vary by usage tier. No Tutor-specific SLA or selected-account capacity is established here. | FACT / PROVIDER CONFIRMATION REQUIRED | Verify limits and deployed-region p50/p95/p99 before rollout. |

## Model capability and pricing

**FACT:** GPT-5.4 Mini is positioned by OpenAI as its strongest mini model for coding, computer use, and subagents. It supports the Responses API and Structured Outputs. The model page lists a 400,000-token context window, a 128,000-token maximum output, and the dated snapshot `gpt-5.4-mini-2026-03-17`.

**FACT:** current list pricing is USD $0.75 per million input tokens, $0.075 per million cached input tokens, and $4.50 per million output tokens. Regional processing carries a documented 10% uplift for this model.

The Phase 4.1 planning workload remains 2,000 input and 500 output tokens per request, assumes no cached-input discount, and uses no tools:

| Monthly requests | Input cost | Output cost | Illustrative total |
| ---: | ---: | ---: | ---: |
| 1,000 | $1.50 | $2.25 | **$3.75** |
| 10,000 | $15.00 | $22.50 | **$37.50** |
| 100,000 | $150.00 | $225.00 | **$375.00** |

These are USD planning estimates, not invoices. They exclude cached-input changes, reasoning-token behavior, regional uplift, taxes, currency conversion, provider rounding, negotiated discounts, retries, Vercel/Firestore costs, and monitoring. **PROVIDER CONFIRMATION REQUIRED:** exact production billing dimensions and account rate tier. **HUMAN/LEGAL REVIEW REQUIRED:** budget ownership and acceptable spend.

## Production model configuration contract

If the recommendation receives later approval, the server-only lock is:

```text
AI_PROVIDER=openai
AI_MODEL=gpt-5.4-mini-2026-03-17
AI_TUTOR_APPROVED_PROVIDER=openai
AI_TUTOR_APPROVED_MODEL=gpt-5.4-mini-2026-03-17
OPENAI_API_KEY=<secret-manager value>
```

The following are required but deliberately do not receive invented values:

```text
AI_TUTOR_PROVIDER_MAX_INPUT_TOKENS=<reviewed exact-model input ceiling>
AI_TUTOR_PROVIDER_INPUT_OVERHEAD_TOKENS=<measured/reviewed protocol overhead>
```

The official 400,000 context limit includes more than the learner payload, and the Responses API counts reasoning within `max_output_tokens`; therefore a safe input ceiling cannot be equated blindly to 400,000. **PROVIDER CONFIRMATION REQUIRED:** choose a conservative ceiling after accounting for the 1,200-token server output maximum, system instruction, JSON envelope/schema, tokenizer behavior, and provider protocol overhead.

Hugging Face remains the active test configuration. No checked-in default switches the runtime to OpenAI.

## Actual outbound data flow

The audited path is:

```text
CompilerPanel
  -> AITutorPanel snapshot
  -> AITutorClient (Firebase token only in Authorization header)
  -> FirebaseAITutorAuthenticator (verified UID retained server-side)
  -> feature gate and trusted activity resolver
  -> normalizeTutorRequest (allowlist, bounds, evidence binding)
  -> TutorSensitiveContentInspector
  -> createTutorProviderRequest
  -> AIProvider adapter
```

The provider can receive only:

- operation (`explain-selection` or `explain-full-code`);
- `python` or `java` language;
- bounded current code;
- bounded selected code only for a selection request;
- bounded, source-bound compiler status/output when current;
- bounded lesson/question/challenge title;
- bounded evidence qualification and response target;
- server-owned Tutor instructions containing the minimum hint/release constraints.

The provider learner-data envelope no longer includes the internal source hash, assessment-policy object, or allowed-hint field. The system instruction still states the minimum server-owned constraint required to direct safe model behavior; server enforcement remains authoritative.

The provider is not intentionally sent Firebase UID, email, profile, authentication token, cookie, session identifier, Firebase credential, Firestore document, Storage metadata, progress, bookmark/settings state, protected answer, hidden test, internal feature/rollout/quota/telemetry state, or provider credential. The bearer token terminates at the API authentication boundary and is never copied into the provider request.

## Source-code privacy and sensitive content

- Source, selection, output, and title limits are enforced before provider construction. Oversized input fails closed rather than being silently truncated.
- High-confidence secrets in source or selection reject the request because redaction could change program semantics.
- High-confidence secrets in compiler output or title are replaced with `[REDACTED]` before provider construction.
- Placeholder credentials such as `YOUR_API_KEY` remain usable.
- Learner-controlled text is serialized inside an explicitly untrusted JSON envelope and cannot select provider, model, policy, schema, or release state.
- Provider output must pass bounded parsing, strict structural validation, evidence checks, solution-release policy, and deep client validation.

**ACCEPTABLE LIMITATION WHILE DISCLOSED AND GATED:** secret inspection is heuristic and cannot guarantee detection of every credential, personal detail, proprietary fragment, or encoded secret. Learners must be warned not to submit such material, and organizational policy must define permitted source-code categories.

## Learner disclosure and accessibility

The disclosure precedes both request controls and now visibly states that an external AI receives relevant code and may be incorrect. Its expandable body lists selected/full code, language, activity title, and available compiler status/output; it asks learners to remove secrets/personal information and verify important guidance.

It uses native `details/summary`, is keyboard operable, does not move focus, and participates in normal flow at narrow widths. Existing reduced-motion rules remove nonessential AI loading animation. No consent conclusion follows from this UI.

**HUMAN/LEGAL REVIEW REQUIRED:** determine whether notice is sufficient or affirmative consent is required, whether consent must be recorded, whether the provider must be named, and how withdrawal, age, institutional, and accessibility requirements apply.

## Data-retention decision matrix

| Data category | Sent? | Purpose | Retention/training/region/deletion evidence | Decision | Owner |
| --- | --- | --- | --- | --- | --- |
| Learner source code | Yes | Explain current program | Default abuse logs up to 30 days; no training by default; region/account dependent; per-request abuse-log deletion not established | REVIEW REQUIRED | Privacy + product |
| Selected code | Only for selection | Scope explanation | Same as source code | REVIEW REQUIRED | Privacy + product |
| Compiler output | When current/relevant | Explain runtime evidence | Same; high-confidence secrets redacted first | REVIEW REQUIRED | Privacy + security |
| Compiler status | Yes | Distinguish static/runtime reasoning | Low-sensitivity operational context; same provider controls | Acceptable if disclosure approved | Product |
| Activity title | When present | Scope terminology | May contain learner-controlled personal text; bounded/redacted heuristically | REVIEW REQUIRED | Product + privacy |
| Tutor request type | Yes | Select response behavior | Non-identity operational data | Acceptable | Engineering |
| Minimal Tutor policy instruction | Yes | Constrain model behavior | Server-owned; no answer key or internal rollout/quota state | Acceptable | Security + learning |
| Authentication data | No | Authentication ends before provider | Not applicable | Must remain excluded | Security |
| Identity/profile data | No | Not required | Not applicable | Must remain excluded | Privacy + engineering |
| Protected answers/tests | No | Not required for explanation | Not applicable | Must remain excluded | Learning + security |

## HUMAN/LEGAL REVIEW REQUIRED

- Whether children/minors may use the Tutor, applicable age thresholds, and parent/guardian mechanisms.
- Whether student code, educational records, account-linked activity, or institution-managed use creates additional contractual or statutory obligations.
- Whether the notice must name OpenAI and disclose default abuse monitoring, possible human review, subprocessors, and cross-border processing.
- Whether affirmative, parental, institutional, or renewed consent is required and how withdrawal is handled.
- Whether ZDR or MAM is mandatory for launch and whether the organization is eligible.
- Controller/processor roles, execution of the DPA, subprocessor review, objection/change process, incident notification, audit materials, and offboarding.
- India DPDP interpretation: notice/consent, children's data, purpose limitation, retention, grievance/withdrawal, cross-border processing, and processor obligations.
- Whether learner code may contain third-party, employer, school, personal, confidential, or regulated information and what use policy applies.
- Data-subject access, deletion, export, dispute, and support procedures when content may exist in provider abuse-monitoring systems.
- Retention and access policy for future MiTutora telemetry, which is not configured in this phase.

No statement in this section asserts GDPR, DPDP, student-privacy, or other legal compliance.

## Privacy risk register

| Risk | Severity | Current control | Remaining decision |
| --- | --- | --- | --- |
| Learner/private source reaches a third party | High | Explicit action, bounds, disclosure, server-only transport | Legal/product approval and allowed-code policy |
| Secret detection misses an unknown format | High | High-confidence rejection/redaction; no environment state | User policy, incident response, periodic detector review |
| Default provider retention/human abuse review | High | `store: false`; no training by default | Approve ZDR/MAM/account configuration |
| Cross-border or multi-subprocessor processing | High | Published region/subprocessor evidence | Contract and India/legal review |
| Minor/student educational data | High | Identity excluded; Level-1 stateless scope | Age/guardian/institution policy |
| Provider policy/model changes | Medium | Exact snapshot and fail-closed lock | Change monitoring and reapproval owner |
| Deletion cannot target all retained abuse data | Medium | Stateless app; no local conversation store | Provider confirmation and user procedure |
| Learner over-trusts AI output | Medium | Visible fallibility statement; release policy | Product copy/usability review |
| Provider outage/rate limits | Medium | Typed failures, timeout, cancellation, kill switch | Capacity/SLO/canary verification |
| Future telemetry becomes a content store | Medium | Strict allowlist; no sink configured | Retention/access approval before connection |

## Provider abstraction and lifecycle policy

The architecture remains `AIProvider -> explain(request, signal) -> normalized text/usage`, followed by provider-independent schema and release enforcement. Providers do not own authentication, UID handling, quota, activity authorization, sensitive-content policy, compiler evidence, release policy, telemetry, or feature gating.

Changing from Hugging Face to OpenAI requires provider/configuration selection and the existing isolated adapter; it does not require React, API-contract, or policy redesign. Automatic substitution is prohibited.

Any provider/model deprecation, version/alias change, pricing change, retention/training change, regional-processing change, subprocessor change, API/schema behavior change, or reliability degradation requires:

1. keep or turn the server feature gate OFF;
2. record the exact proposed provider and pinned model;
3. rerun official policy/privacy/pricing review;
4. rerun deterministic boundaries and all 17 exact-model cases;
5. review quota prices/limits and telemetry alerts;
6. obtain privacy/product/security and production authorization;
7. canary before wider rollout.

If the pinned model becomes unavailable, fail closed with a sanitized unavailable/configuration error. Do not silently route to an alias, newer snapshot, backup provider, or cheaper model.

## Production-model evaluation gate

The exact `openai/gpt-5.4-mini-2026-03-17` combination must independently complete all 17 synthetic exact-model cases and the deterministic boundary suite in the same revision. It must cover prompt injection, solution leakage, sensitive-content interaction, compiler evidence, policy escalation, response safety, strict structured output, release policy, cancellation, and malformed-response handling.

Acceptance requires conclusive model coverage, zero unsafe releases, zero policy bypasses, zero credential leakage, and no malformed response reaching the client. Hugging Face's earlier 8 usable / 9 provider-rejected run is not transferable and does not approve Hugging Face or OpenAI.

## Production approval checklist

| Gate | Status | Reason |
| --- | --- | --- |
| Provider | REVIEW REQUIRED | Recommendation remains sound; commercial/account approval pending. |
| Model | REVIEW REQUIRED | Pinned snapshot exists; exact-model evaluation pending. |
| Pricing | REVIEW REQUIRED | List prices verified; account billing/budget not approved. |
| Token limits | REVIEW REQUIRED | Model limits verified; safe input/overhead values need confirmation. |
| Data handling | REVIEW REQUIRED | Technical minimization passes; organizational acceptance pending. |
| Retention | REVIEW REQUIRED | Default and optional controls documented; selected project posture unknown. |
| Training use | REVIEW REQUIRED | No training by default is documented; account opt-in state must be verified. |
| Regional processing | REVIEW REQUIRED | India storage is not India inference; target route unresolved. |
| Subprocessors | REVIEW REQUIRED | Current list reviewed; contractual acceptance/change process pending. |
| Learner disclosure | REVIEW REQUIRED | Technical disclosure passes; legal/product approval pending. |
| Educational/minor data | REVIEW REQUIRED | Age, guardian, school, and educational-record decisions unresolved. |
| India/DPDP | REVIEW REQUIRED | Legal interpretation and operating policy required. |
| Exact-model evaluation | PENDING | No OpenAI production-model calls were authorized or made. |
| Infrastructure | PENDING | Quota, telemetry, monitoring, alerts, and secrets are not provisioned. |
| Production deployment | PENDING | No deployment authorized. |
| Feature enablement | PENDING | Gate remains disabled. |

## Phase 4.5 classification

- The production-provider decision, current official evidence, real outbound data flow, privacy risks, model configuration contract, lifecycle policy, and exact-model gate are documented.
- The OpenAI adapter explicitly uses `store: false` and the canonical strict response schema.
- The provider learner-data envelope excludes redundant internal snapshot/assessment fields.
- The disclosure now identifies external processing and AI fallibility before request controls.
- No known technical privacy bypass remains in the audited path.
- **Phase 4.5 local review:** COMPLETE.
- **Technical code readiness:** READY for remaining external gates.
- **Production readiness:** NOT READY.

External gates remain provider/account confirmation, privacy/legal/product approval, exact-model evaluation, production quota and telemetry infrastructure, deployed-runtime verification, billing controls, canary, and explicit production authorization.
