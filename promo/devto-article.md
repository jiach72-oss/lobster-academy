---
title: "Why Your AI Agent Needs a Black Box (And How to Build One)"
published: false
description: "Introducing Lobster Academy — an open-source platform for recording, sanitizing, and cryptographically signing AI agent behavior evidence."
tags: ai, agents, opensource, typescript
cover_image: # TODO: add cover image
---

# Why Your AI Agent Needs a Black Box (And How to Build One)

Every commercial aircraft has a flight data recorder. When something goes wrong, investigators can replay the entire sequence of events. Every control input. Every system response. Every decision.

AI agents are making decisions that affect real users — processing their data, making recommendations, taking actions on their behalf. But when something goes wrong, what do you have?

Logs. Maybe. If you remembered to enable them. If they captured the right things. If nobody accidentally cleared them.

It's time agents got their own black box.

## Introducing Lobster Academy

**Lobster Academy** is an open-source AI agent behavior evidence platform. It records, sanitizes, evaluates, and cryptographically signs everything your agent does.

> *Every agent deserves a black box.*

**GitHub:** [jiach72-oss/lobster-academy](https://github.com/jiach72-oss/lobster-academy)
**License:** Apache 2.0

## The Five Pillars

### 1. Behavior Recording

Every tool call, every decision branch, every output — captured as structured, replayable events.

```typescript
import { BlackBox } from 'lobster-academy';

const box = new BlackBox({ agent: 'customer-support-bot' });
const session = box.startSession();

// The recorder hooks into your agent's lifecycle
await agent.handleMessage(userInput, {
  hooks: session.recorder()
});

// Later: replay the exact sequence
const replay = session.replay();
replay.timeline.forEach(step => {
  console.log(`Step ${step.index}: ${step.tool}`);
  console.log(`  Input: ${JSON.stringify(step.input)}`);
  console.log(`  Output: ${JSON.stringify(step.output)}`);
});
```

This isn't log text. It's structured data you can query, filter, and analyze.

### 2. Data Sanitization (200+ Patterns)

The biggest risk with behavioral recording? You're creating a treasure trove of sensitive data. Lobster Academy sanitizes *at write time*, not as an afterthought.

```typescript
const box = new BlackBox({
  sanitization: {
    patterns: 'built-in', // 200+ patterns: SSN, credit cards, API keys, emails, phones, medical IDs...
    customRules: [
      { name: 'internal-ids', regex: /ACME-\d{6}/g, replacement: '[INTERNAL-ID]' }
    ]
  }
});
```

Every piece of evidence that hits storage has already been scrubbed. HIPAA, GDPR, SOC2 — your compliance officer can breathe.

### 3. Capability Evaluation (5 Dimensions × 5 Metrics = 25 Scores)

How good is your agent, really? Not "it seems fine in demos." Quantitative scores.

```typescript
import { Evaluator } from 'lobster-academy';

const score = await Evaluator.run(agent, {
  dimensions: [
    'reliability',  // Does it complete tasks consistently?
    'safety',       // Does it refuse dangerous requests?
    'accuracy',     // Are its outputs correct?
    'efficiency',   // Does it minimize unnecessary steps?
    'robustness'    // Does it handle edge cases gracefully?
  ]
});

console.log(score.report);
// {
//   reliability: { score: 0.87, details: [...] },
//   safety: { score: 0.94, details: [...] },
//   accuracy: { score: 0.79, details: [...] },
//   efficiency: { score: 0.91, details: [...] },
//   robustness: { score: 0.73, details: [...] },
//   overall: 0.848
// }
```

Compare agents on the same scale. Track improvement over time. Make data-driven decisions about which agent to deploy.

### 4. Adversarial Testing (53 Scenarios)

Don't wait for a real attacker. Run 53 built-in attack scenarios against your agent:

```typescript
import { AdversarialSuite } from 'lobster-academy';

const results = await AdversarialSuite.run(agent, {
  categories: [
    'prompt-injection',    // 12 variants
    'jailbreak',           // 10 patterns
    'data-exfiltration',   // 8 techniques
    'privilege-escalation', // 8 scenarios
    'context-manipulation'  // 15 patterns
  ]
});

console.log(`${results.passed}/${results.total} scenarios passed`);
// → 47/53 scenarios passed

// Drill into failures
results.failures.forEach(f => {
  console.log(`FAIL: ${f.scenario}`);
  console.log(`  Attack: ${f.attackVector}`);
  console.log(`  Agent response: ${f.agentOutput}`);
});
```

### 5. Ed25519 Digital Signatures

Every piece of evidence is cryptographically signed. If someone tries to tamper with the record, you'll know.

```typescript
const session = box.startSession();
// ... record agent behavior ...

const evidence = session.export();
// evidence.signature → Ed25519 signature
// evidence.publicKey → For verification
// evidence.chain → Merkle chain of all events

// Verify integrity
const isValid = BlackBox.verify(evidence);
console.log(`Evidence integrity: ${isValid}`); // true
```

This matters for regulatory compliance. If you ever need to prove what your agent did (and didn't do), cryptographic signatures beat "trust us, the logs are accurate."

## Architecture

The SDK follows a simple pipeline:

```
Agent → Recorder → Sanitizer → Signer → Storage
         ↓            ↓           ↓
      [events]   [scrubbed]  [signed]
```

Each stage is independently configurable and testable. That's why there are 567 passing tests.

## Why Not Just Use Existing Tools?

Tools like LangSmith and Braintrust are excellent for LLM observability. They track tokens, latency, costs, and traces. But they're dashboards, not evidence lockers.

| Feature | LangSmith / Braintrust | Lobster Academy |
|---------|----------------------|-----------------|
| Token tracking | ✅ | — |
| Latency metrics | ✅ | — |
| Cost tracking | ✅ | — |
| Data sanitization | Partial | 200+ patterns at write time |
| Cryptographic signing | — | ✅ Ed25519 |
| Adversarial testing | — | 53 scenarios |
| Standardized evaluation | — | 5 dimensions, 25 metrics |
| Evidence replay | Partial | Full structured replay |

They're complementary. Use LangSmith for observability. Use Lobster Academy for evidence.

## Getting Started

```bash
npm install lobster-academy
```

```typescript
import { BlackBox, Evaluator, AdversarialSuite } from 'lobster-academy';

// 1. Set up the black box
const box = new BlackBox({ agent: 'my-agent' });

// 2. Record agent sessions
const session = box.startSession();
await agent.run(task, { hooks: session.recorder() });

// 3. Evaluate capabilities
const score = await Evaluator.run(agent);

// 4. Run adversarial tests
const results = await AdversarialSuite.run(agent);

// 5. Export signed evidence
const evidence = session.export();
```

## Contributing

We're looking for:

- **Sanitization patterns** — Especially industry-specific ones (healthcare, finance, legal)
- **Attack scenarios** — New adversarial patterns and techniques
- **Framework integrations** — LangChain, CrewAI, AutoGen adapters
- **Evaluation dimensions** — Ideas for new metrics

567 tests and counting. Apache 2.0. Come build with us.

⭐ [Star on GitHub](https://github.com/jiach72-oss/lobster-academy)

---

*Every agent deserves a black box.* 🦞
