# AI Tutor Production Model Selection

Decision date: 2026-08-28

Status: **candidate recommendation; not production approval**

Phase 4.5 rechecked the recommendation against current official OpenAI documentation. The recommendation remains internally consistent, but India-specific processing, retention-control eligibility, account limits, and legal/product acceptance remain review gates. See [AI Tutor provider and privacy gate](ai-tutor-provider-privacy-gate.md).

## Objective

Select a primary and backup production model for the MiTutoraPro AI Tutor. The Tutor explains Python and Java code, compiler output, debugging concepts, and progressive hints. It is an educational assistant, not an answer generator. Quality, safety, privacy, predictable structured output, and operational reliability therefore matter more than raw benchmark position or lowest price.

This phase changes no provider configuration or runtime behavior. Production approval still requires the selected exact model to pass MiTutoraPro's 17-case evaluation, a human privacy/provider review, production infrastructure readiness, and controlled-rollout approval.

## Current test provider

The existing Hugging Face configuration (`huggingface` / `openai/gpt-oss-120b:fastest`) is a test setup only. Its controlled run produced 8 usable responses and 9 provider rejections. Server enforcement passed on observed paths, but model behavior remained inconclusive. It is not a production commitment and receives no incumbency advantage in this decision.

## Evaluation methodology

Official provider documentation was reviewed for model status, pricing, context limits, structured output, availability, retention, and lifecycle. Provider-published benchmarks are treated as directional evidence, not independent proof. No live model calls were made.

Scores use a 1–10 scale. They are a decision aid, not a claim of benchmark precision. In particular, safety scores reflect documented controls and expected instruction-following—not proof that a model satisfies MiTutoraPro policy.

| Criterion | Weight | Rationale |
| --- | ---: | --- |
| Programming and explanation quality | 22% | Core learner outcome: correct, understandable Python/Java explanations and debugging help. |
| Safety and instruction following | 18% | The model must resist prompt injection, answer extraction, and learner-controlled policy overrides. |
| Privacy and data handling | 15% | Learner code may be sensitive; retention, training use, review, and deletion controls are release gates. |
| Structured output | 10% | The versioned Tutor schema must parse predictably and fail closed. |
| API reliability | 10% | Availability, rate limits, error semantics, and production maturity directly affect the learning flow. |
| Latency | 8% | Tutor responses should feel interactive; this must be measured from the deployed region. |
| Cost | 7% | Cost must scale sustainably, but a weak or unsafe tutor is not acceptable because it is cheap. |
| Context window | 3% | All candidates comfortably fit present requests; extreme context sizes add little current value. |
| India and regional fit | 3% | Commercial availability, latency, billing, and cross-border processing matter to launch. |
| Model lifecycle | 2% | Stable production IDs and deprecation practices reduce surprise migrations. |
| Provider portability | 2% | The provider interface limits lock-in, though schema/API differences still impose adapter work. |

## Serious candidate shortlist

| Provider | Model | Coding | Safety | Structured output | Latency | Cost | Privacy | Reliability | Overall |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| OpenAI | GPT-5.4 Mini | 9.2 | 8.8 | 9.5 | 8.5 | 8.5 | 8.3 | 9.0 | **8.83** |
| Anthropic | Claude Sonnet 5 | 9.5 | 9.2 | 9.3 | 7.5 | 6.5 | 8.4 | 8.3 | **8.71** |
| OpenAI | GPT-5.6 Terra | 9.6 | 9.0 | 9.5 | 7.2 | 5.5 | 8.3 | 9.0 | **8.68** |
| Google | Gemini 3.7 Flash | 9.0 | 8.3 | 8.6 | 9.0 | 8.5 | 8.0 | 8.8 | **8.61** |
| Groq | GPT-OSS 120B | 7.8 | 6.8 | 9.0 | 10.0 | 10.0 | 9.3 | 7.5 | **8.26** |
| Fireworks AI | Kimi K2.6 | 8.4 | 6.8 | 9.0 | 8.3 | 7.0 | 9.0 | 6.8 | **7.87** |
| Together AI | MiniMax M3 | 8.0 | 6.8 | 8.5 | 8.0 | 9.5 | 7.8 | 6.8 | **7.74** |

Overall scores also include context, India/regional fit, lifecycle, and portability, which are omitted from the compact table. Latency scores are expectations based on service/model positioning and must be replaced by p50/p95 measurements from the production region. Safety scores never replace the exact-model gate.

### Candidate evidence

#### OpenAI GPT-5.4 Mini

- Officially positioned as OpenAI's strongest mini model for coding, computer use, and subagents. It supports structured outputs, has a 400,000-token context window and 128,000-token maximum output, and lists a dated snapshot (`gpt-5.4-mini-2026-03-17`). List pricing is $0.75/M input, $0.075/M cached input, and $4.50/M output tokens. [Model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- The Responses API and strict structured output fit the existing adapter and response schema. Schema enforcement still does not prove semantic policy compliance. [Structured Outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/)
- API data is not used for training by default. Abuse-monitoring logs can be retained for up to 30 days; approved customers may obtain Modified Abuse Monitoring or Zero Data Retention. Responses API storage behavior and `store: false` must be reviewed in the final configuration. [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)
- OpenAI documents an India data-residency storage endpoint requiring MAM or ZDR, while regional inference is not available in India. General production-account access, contracting, and latency remain provider-confirmation items. [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)

#### Anthropic Claude Sonnet 5

- Anthropic positions Sonnet 5 as a frontier coding and agent model at $2/M input and $10/M output. [Announcement](https://www.anthropic.com/news/claude-sonnet-5)
- The model has a 1M-token context window, up to 128k output, and supports structured outputs. The canonical `claude-sonnet-5` ID uses pinned weights, while lifecycle remains subject to Anthropic's retirement policy. [Model overview](https://platform.claude.com/docs/en/models/overview), [model IDs](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)
- JSON-schema structured outputs are generally available and eligible for limited technical retention under qualifying controls. [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- API inputs/outputs are ordinarily deleted within 30 days; Zero Data Retention requires an agreement and has documented scope/exceptions. [Retention](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), [ZDR scope](https://privacy.anthropic.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to)
- India is listed for commercial API access. Sonnet 5 does not currently offer Anthropic Priority Tier, which weakens the operational case for the primary slot despite its quality. [Supported countries](https://www.anthropic.com/supported-countries), [rate limits](https://platform.claude.com/docs/en/api/rate-limits)

#### OpenAI GPT-5.6 Terra

- A higher-capability same-provider alternative with a 1.05M-token context, structured outputs, and pricing of $2/M input, $0.20/M cached input, and $12/M output. [Model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- It scores strongly on coding and keeps adapter risk low, but its estimated request cost is 2.7 times GPT-5.4 Mini under the baseline workload. The present Tutor does not need its much larger context window. It should be reconsidered only if exact A/B evaluation shows a material educational or safety advantage.

#### Google Gemini 3.7 Flash

- A generally available, high-throughput coding/agent model with 1M input context, 64k output, and structured output support. [Model documentation](https://ai.google.dev/gemini-api/docs/latest-model), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- Promotional pricing through 2026-12-31 is $0.75/M input and $3.75/M output; published standard pricing is $1.50/M and $7.50/M afterward. Output billing includes thinking tokens, so real cost may exceed visible response length. [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Paid-service prompts/responses are not used to improve Google products, but abuse-monitoring retention, ZDR feature eligibility, global processing, and deletion terms require review. [ZDR guidance](https://ai.google.dev/gemini-api/docs/zdr), [terms](https://ai.google.dev/gemini-api/terms)
- India is supported. The model became GA in August 2026, so MiTutoraPro has limited lifecycle and production-history evidence at the decision date. [Available regions](https://ai.google.dev/gemini-api/docs/available-regions), [release notes](https://ai.google.dev/gemini-api/docs/changelog)

#### Groq GPT-OSS 120B

- Groq lists the production model at approximately 500 tokens/second, $0.15/M input and $0.60/M output, with 131,072-token context and 65,536-token output limits. [Supported models](https://console.groq.com/docs/models)
- Strict JSON-schema constrained output is supported, with documented incompatibilities for some simultaneous features such as streaming/tool use. [Structured outputs](https://console.groq.com/docs/structured-outputs)
- Inference data is not retained by default; optional temporary logging may last up to 30 days and all customers can request/configure ZDR. Retained processing is documented in US Google Cloud infrastructure. [Data handling](https://console.groq.com/docs/your-data)
- The latency and cost are excellent, and India-specific billing is documented. However, the underlying GPT-OSS 120B behavioral evaluation through the temporary Hugging Face route was incomplete. A different host can improve serving reliability, but cannot be assumed to improve policy behavior. [Billing](https://console.groq.com/docs/billing-faqs)

#### Together AI MiniMax M3

- Together lists the serverless model at $0.30/M input and $1.20/M output with a 524,288-token context window and structured output/function support. Serverless requires no minimum commitment; dedicated endpoints or provisioned throughput are the higher-assurance options. [Serverless models](https://docs.together.ai/docs/serverless/models), [chat parameters](https://docs.together.ai/docs/inference/chat/parameters)
- Together states it does not train on customer data without explicit opt-in and offers ZDR controls. Contract, processing-region, subprocessor, and deletion details still need human review. [Privacy policy](https://www.together.ai/privacy)
- It is economically attractive and portable, but has less provider-specific evidence for educational safety, serving SLOs, and India routing than the finalists.

#### Fireworks AI Kimi K2.6

- Fireworks lists Kimi K2.6 priority pricing at $1.50/M input and $6/M output and supports JSON-schema/grammar-constrained responses. [Pricing](https://docs.fireworks.ai/serverless/pricing), [structured responses](https://docs.fireworks.ai/structured-responses/structured-response-formatting)
- Fireworks documents no prompt/generated-data logging for serverless inference, retaining token metadata, but also describes serverless as best effort without an uptime or latency SLA and gives at least two weeks' deprecation notice. [Model and data overview](https://docs.fireworks.ai/models/overview)
- Privacy is strong on paper, but the serverless reliability/lifecycle posture and limited model-specific Tutor safety evidence make it a weaker initial production choice. [Privacy policy](https://fireworks.ai/privacy-policy)

## Pricing and cost scenarios

### Assumptions

The planning baseline is **2,000 input tokens and 500 output tokens per request**:

- roughly 500 tokens of server policy/schema framing;
- roughly 1,500 tokens of selected/full code, compiler evidence, language, and short lesson context;
- a bounded 500-token educational response.

This deliberately assumes no cache discount because learner code and compiler evidence vary. It excludes taxes, currency conversion, optional priority/dedicated capacity, and enterprise contract minimums. No tools, web search, file storage, or fine-tuning are assumed. Reasoning/thinking tokens billed as output can raise actual cost. Production telemetry should replace these assumptions with sanitized token aggregates before broad rollout.

| Candidate | List input / output per 1M | Estimated/request | 1,000 requests | 10,000 requests | 100,000 requests |
| --- | ---: | ---: | ---: | ---: | ---: |
| OpenAI GPT-5.4 Mini | $0.75 / $4.50 | $0.00375 | **$3.75** | **$37.50** | **$375.00** |
| Anthropic Claude Sonnet 5 | $2.00 / $10.00 | $0.00900 | $9.00 | $90.00 | $900.00 |
| OpenAI GPT-5.6 Terra | $2.00 / $12.00 | $0.01000 | $10.00 | $100.00 | $1,000.00 |
| Google Gemini 3.7 Flash (2026 promotional) | $0.75 / $3.75 | $0.003375 | $3.38 | $33.75 | $337.50 |
| Google Gemini 3.7 Flash (published standard) | $1.50 / $7.50 | $0.00675 | $6.75 | $67.50 | $675.00 |
| Groq GPT-OSS 120B | $0.15 / $0.60 | $0.00060 | $0.60 | $6.00 | $60.00 |
| Together MiniMax M3 | $0.30 / $1.20 | $0.00120 | $1.20 | $12.00 | $120.00 |
| Fireworks Kimi K2.6 priority | $1.50 / $6.00 | $0.00600 | $6.00 | $60.00 | $600.00 |

Operation mix will change token usage. Selection explanations are likely below baseline; full-code debugging may exceed it. A useful sensitivity case is 3,000 input plus 1,000 output tokens: GPT-5.4 Mini becomes $0.00675/request, or approximately $6.75 / $67.50 / $675 for the same monthly volumes. Cached system/schema prefixes may reduce input cost but are not included in the budget.

## Privacy and human review gate

Official terms support a viable API path, but documentation review is not legal approval. Before any learner data is sent, an authorized privacy/legal owner must confirm:

1. the provider agreement and DPA, processor/controller roles, subprocessors, and international-transfer mechanism for learners in India and other supported regions;
2. whether the launch requires approved ZDR or Modified Abuse Monitoring rather than default retention;
3. the exact Responses API setting (`store: false`) and whether any schema, abuse classifier, or safety metadata remains retained;
4. whether human review can occur, its purpose and scope, and how this is disclosed;
5. deletion/subject-access handling, incident notification, breach responsibilities, and provider offboarding;
6. treatment of minors and educational data under applicable law, including India's DPDP framework and any school/customer obligations;
7. a minimization record showing that UID, identity, tokens, credentials, protected answers, and unrelated state never enter provider payloads;
8. learner-facing disclosure and consent/notice language, including cross-border processing and AI limitations.

The server must continue outbound secret screening. It is heuristic defense-in-depth, not a guarantee that learner code contains no secrets.

## Reliability and lifecycle analysis

- **OpenAI GPT-5.4 Mini:** production model, dated snapshot, mature API/error semantics, prompt caching, and documented rate tiers. The selected account's actual limits and any regional-processing surcharge/availability must be confirmed. A dated snapshot avoids silent weight changes.
- **Anthropic Sonnet 5:** production model with pinned canonical weights and strong API controls. The lack of Priority Tier for Sonnet 5 is a material operational limitation for backup capacity planning.
- **Gemini 3.7 Flash:** GA, priority inference available, and broad regional access. It is new at the decision date, and its promotional price expires. The JSON-schema subset must be tested against the exact Tutor schema.
- **Groq GPT-OSS 120B:** production endpoint and exceptional advertised throughput, but fewer model choices and incomplete MiTutoraPro behavioral evidence.
- **Together/Fireworks:** credible open-model hosts, but serverless capacity/SLA and model lifecycle are less predictable. Dedicated endpoints would change both the reliability and cost comparison.

No provider's marketing latency is sufficient. A later controlled rollout must record sanitized p50/p95/p99 end-to-end latency, timeout rate, schema-rejection rate, provider error category, and release-gate rejection rate from the actual Vercel region.

## Security analysis

There is insufficient public evidence to prove that any candidate will reliably resist MiTutoraPro-specific prompt injection or solution extraction. General coding benchmarks do not measure teaching quality, and provider safety reports do not test this server-owned policy.

**Exact-model validation using MiTutoraPro's 17-case evaluation matrix is mandatory before production.** The release decision is a system property:

- model behavior is measured separately from server enforcement;
- an unsafe model attempt is not released if the response gate catches it;
- a policy-violating response that crosses the release boundary is a failure;
- provider refusals/failures do not count as behavioral passes;
- all 17 cases must receive enough usable responses to reach a conclusive result;
- the deterministic 94-case boundary suite must pass in the same revision (111 total cases);
- changing provider, exact model/snapshot, Tutor system policy, release policy, or response schema invalidates prior evidence.

The 17 live cases cover nine prompt-injection vectors and eight solution-leak vectors, including system/policy extraction, fake authorization, hint escalation, source/lesson/compiler-output injection, complete solution requests, corrected/replacement code, missing lines, answer-only requests, and learner-controlled hint level. The existing deterministic suite separately covers sensitive content, compiler evidence, malformed structures, provider failures, policy escalation, client bypass, feature gating, and hard quota enforcement.

## Architecture compatibility

All shortlisted APIs can remain behind the existing interface:

```text
AIProvider
  -> explain(request, signal)
  -> normalized Tutor response
```

The adapter owns only provider authentication, request formatting, invocation, cancellation mapping, response normalization, and usage extraction. Tutor policy, hint policy, quota, release decisions, identity, and telemetry remain provider-neutral server concerns.

- OpenAI is the lowest-impact primary because an isolated OpenAI provider already exists and the Responses API supports the required strict response structure.
- Anthropic requires a new isolated adapter and schema mapping, but no architecture redesign.
- Gemini likewise needs a provider adapter and validation of its schema subset.
- OpenAI-compatible hosts reduce transport work, but compatibility does not make their model behavior, errors, usage accounting, or privacy equivalent.

Provider-specific schemas must not leak into React, the API route contract, policy engine, or evaluation matrix.

## Recommendation

### Primary candidate

**Provider:** OpenAI  
**Model:** GPT-5.4 Mini, evaluated and ultimately pinned to `gpt-5.4-mini-2026-03-17` if it passes

GPT-5.4 Mini has the best current balance: high coding suitability, strict structured output, a mature production API, a stable dated snapshot, manageable cost, sufficient context, documented India availability, and the smallest adapter change. The baseline cost is approximately $0.00375/request, while the model is explicitly positioned for coding rather than merely cheap text generation.

This is a candidate recommendation, not production approval. Do not configure production yet.

### Backup candidate

**Provider:** Anthropic  
**Model:** Claude Sonnet 5 (`claude-sonnet-5`)

Sonnet 5 is the strongest provider-diverse backup based on coding/agent positioning, structured output, long context, pinned weights, and safety emphasis. It costs more and currently lacks Priority Tier, so it is better suited to failover or a quality benchmark than the default high-volume path. Backup activation requires its own full exact-model evaluation and privacy review; primary results do not transfer.

### Why the alternatives were not selected

- **GPT-5.6 Terra:** potentially higher quality, but 2.7 times the baseline primary cost, much more context than needed, and no provider diversity. Reconsider only if exact paired evaluation shows a material learning/safety gain.
- **Gemini 3.7 Flash:** compelling latency, price, and context, but it is very new, the current price is promotional, thinking tokens complicate cost, and schema/retention behavior needs more operational evidence. It is the strongest third candidate.
- **Groq GPT-OSS 120B:** excellent price and speed, strong ZDR posture, but the underlying model's MiTutoraPro behavioral evidence is incomplete. Serving it through Groq may fix provider reliability, not instruction-following risk.
- **Together MiniMax M3:** attractive price and open-model portability, but less educational-safety evidence and weaker documented serverless assurance/India routing than finalists.
- **Fireworks Kimi K2.6:** strong structured response and data-minimization posture, but best-effort serverless reliability and shorter lifecycle notice are not ideal for the first production Tutor.
- **Self-hosting/open-weight deployment:** deferred. It could maximize control but adds GPU capacity, autoscaling, patching, model-serving security, monitoring, data residency, and on-call ownership. At present volumes it is unlikely to beat a managed API on total operational cost or reliability.

## Exact-model evaluation and rollout gate

Before production configuration:

1. Pin the exact primary snapshot and approved provider/model lock.
2. Configure reviewed maximum input, protocol overhead, bounded output, timeout, and no automatic evaluation retries.
3. Run all 17 exact-model cases using synthetic data only; retain only sanitized case metadata.
4. Run all 94 deterministic cases in the same revision.
5. Require zero unsafe releases, full structured-schema compliance, conclusive model coverage, and green server enforcement.
6. Conduct a small synthetic A/B teaching review against Sonnet 5 for correctness, beginner clarity, progressive hints, and refusal quality; this complements but does not replace the security matrix.
7. Complete the privacy/legal gate and provider account/retention configuration.
8. Verify distributed quota, telemetry, alerts, feature gate, rollback, and provider kill switch.
9. Start with an allowlisted/canary cohort and explicit rollback thresholds for error rate, latency, schema failures, unsafe releases, and budget.

The backup must be tested independently. Automatic failover must not bypass per-provider quota, privacy configuration, model lock, response release, or telemetry.

## Known uncertainties

- No selected candidate has yet run the exact 17-case matrix.
- No independent MiTutoraPro teaching-quality comparison has been run.
- Public benchmark suites poorly represent beginner explanation and progressive-hint behavior.
- Real latency and rate-limit behavior from the deployed region are unknown.
- Token mix, reasoning-token usage, cache hit rate, taxes, currency conversion, and negotiated pricing may materially change cost.
- ZDR/modified retention eligibility and contract terms require provider confirmation.
- Data residency and cross-border legal treatment require human review.
- Provider models, pricing, limits, and lifecycle policies can change; recheck immediately before procurement and rollout.
- Backup failover capacity and commercial limits have not been reserved.

## Evidence classification

- **Official facts:** prices, published limits, model status, API features, supported regions, and provider-described retention in the linked provider documentation.
- **Provider evidence:** provider-authored performance/safety positioning. Useful for discovery, not independent validation.
- **MiTutoraPro inference:** weighted scores, cost workload assumptions, primary/backup ranking, and architectural recommendation.
- **Required future evidence:** exact-model security results, human teaching review, deployed-region latency, production quota behavior, and signed privacy/legal approval.

## Decision

Advance OpenAI GPT-5.4 Mini and Anthropic Claude Sonnet 5 to controlled, exact-model evaluation as primary and backup candidates respectively. Do not configure production yet. Neither model is production-approved at this stage.
