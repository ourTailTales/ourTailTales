# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured with Session Replay, Error Tracking, and Support available, plus native responders for setup health, error changes, and support tickets. The project’s browser SDK initialization already allows replay and exception capture; no application code was changed.

Findings should begin appearing in the [Self-driving inbox](https://us.posthog.com/project/608177/inbox) within about 30 minutes as the coordinator picks up the new configuration.

## AI data processing

Approved by the wizard’s organization-level gate before this setup ran.

## GitHub

The PostHog GitHub App was already connected before this run, as verified by the wizard. No GitHub Issues responder was enabled because no connected tools were selected in this run.

## Products enabled

| Product | Result | Notes |
|---|---|---|
| Session Replay | Already enabled | Browser `posthog.init` does not disable recording. A recent web recording exists. |
| Error Tracking | Already enabled | Browser `posthog.init` explicitly enables exception capture. |
| Support | Enabled | An inbound email, inbox, or Slack channel must be connected in PostHog before tickets arrive. |

## Signal sources

| Source product | Source type | Action |
|---|---|---|
| `signals_scout` | `cross_source_issue` | On by default; no opt-out row existed, so none was created. |
| `health_checks` | `health_issue` | Enabled (source config `01a09e75-6723-77ad-a862-c09d43493d73`). |
| `error_tracking` | `issue_created` | Enabled (source config `01a09e75-6767-7a33-9ea1-25cbab1f9a8d`). |
| `error_tracking` | `issue_reopened` | Enabled (source config `01a09e75-671e-7ca5-ad64-2c60d4dfd26d`). |
| `error_tracking` | `issue_spiking` | Enabled (source config `01a09e75-672a-71eb-a492-4c67f0c90adc`). |
| `conversations` | `ticket` | Enabled (source config `01a09e75-6748-7a1d-8e6a-00814365fe35`). |
| Session Replay source | — | Deliberately skipped: Replay Vision scanners are the dedicated route into the inbox. |

## Connected tools

No external connected tools were selected. The warehouse-source inventory was empty, and no external responder was enabled.

## Scout troop

**Active scouts (5):**

| Scout | Why it is active |
|---|---|
| `signals-scout-general` | Cross-product correlations and surfaces without a specialist. |
| `signals-scout-product-analytics` | Core product funnel and engagement health. |
| `signals-scout-revenue-analytics` | Payment and revenue reliability; the repository uses Stripe. |
| `signals-scout-ai-observability` | Model-operation reliability; the repository uses an AI SDK. |
| `signals-scout-web-analytics` | Web traffic, attribution, and landing-page health. |

**Disabled scouts (22):**

| Scout | Why it remains disabled |
|---|---|
| `signals-scout-anomaly-detection` | Not selected as a top surface; the general scout provides broad coverage. |
| `signals-scout-apm` | No distributed-tracing usage was identified. |
| `signals-scout-conversations` | Support has just been enabled and no inbound channel is connected yet. |
| `signals-scout-csp-violations` | No CSP-reporting configuration was identified. |
| `signals-scout-customer-analytics` | No account/group analytics surface was identified. |
| `signals-scout-data-pipelines` | No CDP destination, batch-export, or flow usage was identified. |
| `signals-scout-data-warehouse` | No warehouse sources are connected. |
| `signals-scout-error-tracking` | Covered by the enabled native Error Tracking responder. |
| `signals-scout-experiments` | No active experiments were identified. |
| `signals-scout-feature-flags` | No feature-flag usage was identified. |
| `signals-scout-health-checks` | Native setup-health responder is enabled; it avoids redundant coverage. |
| `signals-scout-inbox-validation` | No resolved Self-driving findings exist to validate yet. |
| `signals-scout-insight-alerts` | No alert usage was identified. |
| `signals-scout-logs` | No PostHog logs usage was identified. |
| `signals-scout-mcp-tool-calls` | No project MCP tool-call product usage was identified. |
| `signals-scout-observability-gaps` | Not selected among the highest-priority recurring surfaces. |
| `signals-scout-replay-vision` | Newly created monitors need observations before an aggregate analyst is useful. |
| `signals-scout-session-replay` | Covered by the Replay Vision scanners below. |
| `signals-scout-skills-store` | No project skills-store usage was identified. |
| `signals-scout-surveys` | No surveys exist. |
| `signals-scout-tasks` | No PostHog Tasks usage was identified. |
| `signals-scout-web-vitals` | Web-vitals usage was not confirmed. |

The verified scout limit is **100 runs/day**; **0** had been used at setup time, with **100** remaining. The current banner says: “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

## Custom scouts

No custom scouts were created. One focused candidate was proposed: a liveness monitor for the book-creation journey, intended to catch a key stage receiving unusually little traffic or a handoff going quiet. It complements the enabled product-analytics scout, which is aimed at conversion-rate changes when entrant volume holds. The proposal was declined.

A deeper fulfillment monitor was ruled out because the current tracked outcomes establish payment results but not a complete print-fulfillment success/failure pair, so it lacks a reliable signal-versus-noise discriminator. If a custom scout is later created and becomes noisy, set `emit: false` on its scout configuration in PostHog to keep it in dry-run mode.

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes what it finds to the inbox. These are the only configuration in this setup that spends Replay Vision quota. Findings arrive at half weight and require corroboration before promotion to a report.

| Brief | Scanner | Status | Scope | Sampling | Estimate |
|---|---|---|---|---|---|
| Breakage monitor | **Checkout breakage** | Created | Recordings that include a URL containing `/checkout`, the product’s completion flow. It watches visible pricing, story/preview, payment, and confirmation failures. | 0.5 | 0 observations / 0 credits per month in the one-day estimate window. |
| Frustration monitor | **Creation journey frustration** | Created | Recordings containing `$rageclick` only, without a URL filter, to avoid materially overlapping the breakage monitor. It watches visible struggle across album selection, processing, story generation, sizing, payment, and confirmation. | 1.0 | 0 observations / 0 credits per month in the one-day estimate window. |

Replay Vision has a verified 2,500-credit monthly limit, with 2,500 credits remaining and no current use. The project has recordings, though neither new monitor matched a session in its estimate window. Both monitors are armed and will start producing observations whenever matching recordings arrive.

## Files modified or created

- Created `posthog-self-driving-report.md` (this report).
- Installed local setup guidance under `.claude/skills/replay-vision-scanners-core/`, `.claude/skills/replay-vision-scanner-broken-experiences/`, and `.claude/skills/replay-vision-scanner-user-frustration/`.
- No product source files or environment files were modified.

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so the enabled ticket responder can receive support tickets.
- [ ] Review the two Replay Vision monitors after they accumulate observations; rate findings in their scanner pages to generate configuration recommendations.
- [ ] Enable any currently disabled specialist scout from the inbox if the associated product surface becomes active.

## What happens next

The scout coordinator should pick up the fresh configurations within about 30 minutes. Scouts draw from the project’s daily run budget, and corroborated findings cluster into reports in the [Self-driving inbox](https://us.posthog.com/project/608177/inbox). Immediately actionable reports can then start coding tasks.