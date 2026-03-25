# The Black Box Problem: Why AI Agents Need Forensic Evidence, Not Just Dashboards

## When Things Go Wrong With Agents

Last month, a customer support AI agent at a mid-size SaaS company hallucinated a refund policy that didn't exist. The customer quoted it back. Legal got involved. The company had no clear record of what the agent actually said, when it said it, or why.

This isn't hypothetical. It's happening everywhere agents are deployed. And it reveals a fundamental gap in the AI tooling ecosystem: we have observability, but we don't have evidence.

## Observability ≠ Evidence

The current crop of agent tooling is excellent at what it does. LangSmith, Braintrust, and similar platforms give you dashboards: token counts, latency graphs, cost breakdowns, conversation traces. They answer "what happened" at a high level.

But when you need to answer harder questions — "prove exactly what the agent did," "demonstrate that the data was handled safely," "show that nobody tampered with this record" — dashboards fall short.

What you need is evidence. Forensic-grade, structured, cryptographically signed evidence.

## Introducing Lobster Academy

[Lobster Academy](https://github.com/jiach72-oss/lobster-academy) is an open-source platform designed to fill this gap. It gives AI agents what aircraft have had for decades: a black box.

> *Every agent deserves a black box.*

The platform provides five capabilities:

### 1. Structured Behavior Recording

Not text logs. Structured, discrete events capturing every tool call, decision branch, and output. Each event includes full context, enabling complete session replay.

### 2. Proactive Data Sanitization (200+ Patterns)

The paradox of agent evidence: recording everything creates a data liability. Lobster Academy solves this by sanitizing at write time — 200+ built-in patterns strip PII, credentials, and sensitive data before anything hits storage. Custom rules are trivial to add.

This isn't masking. It's prevention. The sensitive data never exists in the stored evidence.

### 3. Standardized Capability Evaluation (5 Dimensions, 25 Metrics)

How do you compare Agent A to Agent B? Most teams rely on vibes or cherry-picked examples. Lobster Academy provides a standardized evaluation framework:

- **Reliability** — Task completion rate, error handling, consistency
- **Safety** — Refusal accuracy, boundary adherence, harm prevention
- **Accuracy** — Output correctness, factual grounding, precision
- **Efficiency** — Step minimization, resource usage, time to completion
- **Robustness** — Edge case handling, ambiguity resolution, recovery

Each dimension has 5 specific metrics, yielding 25 quantitative scores. Compare agents on the same scale. Track improvement over releases.

### 4. Adversarial Testing (53 Attack Scenarios)

The platform includes 53 pre-built adversarial scenarios spanning five categories:

- Prompt injection (12 variants)
- Jailbreak patterns (10 techniques)
- Data exfiltration (8 methods)
- Privilege escalation (8 scenarios)
- Context manipulation (15 patterns)

Run them against your agent before deployment. Generate a security posture score. Know your weaknesses before an attacker does.

### 5. Cryptographic Evidence Integrity (Ed25519)

Every piece of evidence is digitally signed using Ed25519. The signature chain ensures:

- Evidence hasn't been altered after recording
- The sequence of events is verifiable
- The recording source is authenticated

For regulated industries (healthcare, finance, legal), this isn't optional — it's table stakes.

## Architecture and Design Decisions

The SDK follows a pipeline architecture:

```
Agent → Recorder → Sanitizer → Signer → Storage
```

Each stage is independently configurable and tested. The 567-test suite covers the full pipeline, edge cases, and adversarial inputs.

Key design decisions:

- **Sanitization at write time** — Sensitive data never touches storage
- **Event-sourced architecture** — The complete history is reconstructable from events
- **No cloud dependency** — Everything runs locally or in your infrastructure
- **Apache 2.0 license** — No vendor lock-in, no usage restrictions

## Who Is This For?

- **Enterprise teams** deploying agents in regulated environments (healthcare, finance, legal)
- **Agent framework developers** who want to offer evidence capabilities to their users
- **Security teams** conducting agent risk assessments
- **Compliance officers** who need audit trails with cryptographic integrity
- **Researchers** studying agent behavior patterns

## Getting Started

```bash
npm install lobster-academy
```

```typescript
import { BlackBox, Evaluator, AdversarialSuite } from 'lobster-academy';

const box = new BlackBox({ agent: 'my-agent' });
const session = box.startSession();

await agent.run(task, { hooks: session.recorder() });

// Evaluate
const score = await Evaluator.run(agent);

// Attack test
const results = await AdversarialSuite.run(agent);

// Export signed evidence
const evidence = session.export();
```

Full documentation, test suite, and contribution guidelines on [GitHub](https://github.com/jiach72-oss/lobster-academy).

## What's Next

We're building toward:

- Framework integrations (LangChain, CrewAI, AutoGen)
- Industry-specific sanitization pattern packs
- Web UI for evidence review and replay
- Compliance report generation (SOC2, HIPAA templates)

## Open Source, Open Evidence

Agent accountability shouldn't be proprietary. If agents are going to make decisions that affect people, the evidence of how they decided needs to be open and verifiable.

Apache 2.0. 567 tests. [Star it](https://github.com/jiach72-oss/lobster-academy), use it, break it, improve it.

*Every agent deserves a black box.* 🦞
