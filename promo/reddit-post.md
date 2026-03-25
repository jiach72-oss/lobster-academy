# Reddit Posts

---

## Post 1: r/MachineLearning

**Title:** [P] Open-source flight recorder for AI agents — behavior recording, 200+ sanitization patterns, 53 adversarial tests (Apache 2.0)

**Body:**

Hey r/MachineLearning,

I built **Lobster Academy** — an open-source platform that acts as a "black box" for AI agents. Every agent deserves one, right?

**The problem:** When your agent misbehaves (leaks PII, hallucinates badly, gets jailbroken), most teams have... vibes and logs. No structured evidence, no replay, no integrity guarantee.

**What it does:**

- **Behavior recording** — Full context replay of every tool call and decision
- **Data sanitization** — 200+ regex patterns strip PII/secrets *before* storage
- **Capability evaluation** — 5 dimensions, 25 metrics (reliability, safety, accuracy, efficiency, robustness)
- **Adversarial testing** — 53 attack scenarios including prompt injection, data exfiltration, privilege escalation
- **Ed25519 signatures** — Cryptographic proof your evidence hasn't been tampered with

**Quick example:**

```typescript
import { BlackBox, Evaluator } from 'lobster-academy';

const box = new BlackBox({ agent: 'my-agent' });
const session = box.startSession();

// Record everything
await agent.run("Process user query", { hooks: session.recorder() });

// Replay later with full context
const replay = session.replay();

// Evaluate across 25 metrics
const score = await Evaluator.run(agent);
```

**Stats:** 567 tests passing | Apache 2.0 | TypeScript SDK + Next.js docs

GitHub: https://github.com/jiach72-oss/lobster-academy

Looking for feedback on the evaluation framework especially — is 5 dimensions / 25 metrics the right granularity? What are we missing?

---

## Post 2: r/programming

**Title:** Open-source "black box" for AI agents — records, sanitizes, and cryptographically signs agent behavior evidence

**Body:**

Shipped a side project I've been working on: **Lobster Academy** — a TypeScript SDK that gives AI agents the same treatment we give aircraft.

**Why:** If agents are making decisions that affect real users, you need forensic evidence. Not vibes. Not grep through stdout. Structured, replayable, tamper-proof evidence.

**Key features:**

1. **Behavior recording** — Every tool call captured with inputs/outputs/context
2. **200+ sanitization patterns** — PII and secrets stripped before anything hits disk
3. **Ed25519 digital signatures** — Cryptographic chain of custody
4. **53 adversarial test scenarios** — Prompt injection, jailbreak, data exfil patterns
5. **5-dimension evaluation** — 25 quantitative metrics for agent comparison

```typescript
const session = box.startSession();
await agent.run(task, { hooks: session.recorder() });

// Evidence is sanitized + signed at write time
const evidence = session.export(); // Ed25519 signed
```

567 tests, all green. Apache 2.0.

GitHub: https://github.com/jiach72-oss/lobster-academy

---

## Post 3: r/opensource

**Title:** [Release] Lobster Academy — open-source AI agent behavior evidence platform (Apache 2.0, 567 tests)

**Body:**

Released **Lobster Academy**, an open-source platform for recording, evaluating, and stress-testing AI agents.

**What it is:**
- TypeScript SDK for agent behavior recording with data sanitization
- Evaluation framework: 5 dimensions, 25 metrics
- Adversarial testing: 53 attack scenarios
- Ed25519-signed evidence for tamper-proof audit trails

**Why it's open source:**
Agent accountability shouldn't be a proprietary black box (ironic, I know). If agents are going to be making decisions in production, the evidence of *how* they decided needs to be open and verifiable.

**Stats:**
- Apache 2.0 license
- 567 tests passing
- TypeScript SDK + Next.js 14 docs site
- Bilingual docs (EN/CN)

**Looking for:**
- Contributors (especially for new sanitization patterns and attack scenarios)
- Framework integrations (LangChain, CrewAI, AutoGen)
- Feedback on the evaluation metrics

GitHub: https://github.com/jiach72-oss/lobster-academy

Stars appreciated but issues/PRs more so. 🦞
