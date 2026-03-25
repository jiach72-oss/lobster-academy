When your AI agent goes rogue — leaking PII, hallucinating legal advice, or getting prompt-injected — what evidence do you have?

Most teams grep through unstructured logs and guess. That's not good enough for production, and it's definitely not good enough for SOC2.

**Lobster Academy** gives your agents a flight recorder: structured, sanitized, cryptographically signed evidence of every decision they make.

---

## What It Does

| Capability | What You Get |
|------------|-------------|
| 📹 Behavior Recording | Every tool call, decision branch, and output — structured and replayable |
| 🔒 Data Sanitization | 200+ patterns that strip PII/secrets *before* storage, not after a breach |
| 🎯 Capability Evaluation | 5 dimensions × 5 metrics = 25 quantitative scores to compare agents objectively |
| 🛡️ Adversarial Testing | 53 attack scenarios (prompt injection, jailbreak, data exfil, privilege escalation) |
| 📜 Ed25519 Signatures | Cryptographic chain of custody — tamper-proof evidence, court-ready |

---

## Quick Start

```bash
npm install lobster-academy
```

```typescript
import { BlackBox, Evaluator, AdversarialSuite } from 'lobster-academy';

// 1. Record — hook into your agent's execution
const box = new BlackBox({ agent: 'support-bot' });
const session = box.startSession();

await agent.handleMessage(userInput, {
  hooks: session.recorder()
});

// 2. Replay — step through exactly what happened
const replay = session.replay();
// → [{ step: 1, tool: "lookup_user", input: {...}, output: {...} }, ...]

// 3. Evaluate — score against 25 standardized metrics
const report = await Evaluator.run(agent);
// → { reliability: 82, safety: 95, accuracy: 78, ... }

// 4. Attack — stress-test before deploying
const redTeam = await AdversarialSuite.run(agent, {
  scenarios: ['prompt-injection', 'data-exfil', 'jailbreak']
});
// → { passed: 47, failed: 6, critical: 1 }
```

---

## How It Compares

| | LangSmith / Braintrust | Lobster Academy |
|---|---|---|
| **Purpose** | Observability (latency, tokens, traces) | Forensic evidence (sanitized, signed, replayable) |
| **Audience** | Developer debugging | Compliance, security, legal |
| **Output** | Dashboards & metrics | Tamper-proof audit trail |
| **Privacy** | Optional masking | Sanitization by default (write-time) |

Different problems. They complement each other.

---

## Stats

- ✅ **567 tests** — all passing
- 🔒 **200+ sanitization patterns** — PII, API keys, cloud credentials, medical records
- 🛡️ **53 adversarial scenarios** — the most common agent attack vectors covered
- 📊 **25 evaluation metrics** — standardized across reliability, safety, accuracy, efficiency, robustness
- 📦 **TypeScript SDK** — zero external dependencies for core functionality
- 📄 **Apache 2.0** — use it anywhere

---

## Looking For Contributors

We're actively seeking help with:

- **New sanitization patterns** — especially regulated-industry specific (healthcare, finance, legal)
- **Attack scenarios** — novel jailbreak techniques, multi-turn manipulation patterns
- **Framework integrations** — LangChain, CrewAI, AutoGen, DSPy hooks
- **Evaluation dimensions** — suggestions for additional scoring axes

If you build or deploy AI agents in production, we'd love your feedback on what matters most.

⭐ **Star** → [github.com/jiach72-oss/lobster-academy](https://github.com/jiach72-oss/lobster-academy)
