# Hacker News Post

## Title (pick one)

- **Option A:** Lobster Academy – Open-source flight recorder for AI agents
- **Option B:** Show HN: Every agent deserves a black box (open-source agent evidence platform)

## URL

https://github.com/jiach72-oss/lobster-academy

## First Comment (Show HN)

Hi HN,

I built **Lobster Academy** — an open-source platform that gives AI agents a "black box" flight recorder.

**The problem:** When agents make bad decisions (leak data, hallucinate, get jailbroken), most teams have no forensic evidence. You grep through logs and guess. In regulated industries, this is a compliance nightmare.

**What it does:**

1. **Behavior recording** — Structured capture of every tool call, decision branch, and output. Full replay capability.

2. **200+ data sanitization patterns** — PII, secrets, credentials stripped *before* storage. Not "we'll mask it later when we remember."

3. **Capability evaluation** — 5 dimensions × 5 metrics = 25 quantitative scores. Reliability, safety, accuracy, efficiency, robustness. Compare agents on the same scale.

4. **Adversarial testing** — 53 attack scenarios: prompt injection variants, jailbreak patterns, data exfiltration, privilege escalation. Run them against your agent before deploying.

5. **Ed25519 digital signatures** — Every piece of evidence is cryptographically signed. Tamper-proof chain of custody.

**Architecture:**

TypeScript SDK — record → sanitize → sign → store. The Next.js site is just docs.

```typescript
import { BlackBox, Evaluator } from 'lobster-academy';

const box = new BlackBox({ agent: 'customer-support-bot' });
const session = box.startSession();

// Agent runs with full recording
await agent.handleMessage(userInput, { hooks: session.recorder() });

// Later: replay the exact sequence of decisions
const replay = session.replay();

// Or: run adversarial tests
const results = await AdversarialSuite.run(agent, {
  scenarios: ['prompt-injection', 'data-exfil', 'jailbreak']
});
// → { passed: 47, failed: 6, details: [...] }
```

**Why not just use LangSmith / Braintrust / existing tools?**

Those are great for LLM observability (tokens, latency, traces). Lobster Academy is specifically about *evidence*: structured, sanitized, signed, replayable proof of what your agent did and why. Different problem. Think compliance officer, not dashboard.

**Stats:** 567 tests | Apache 2.0 | TypeScript

Happy to answer questions. Feedback on the evaluation dimensions especially welcome.

---

## HN-specific notes

- HN favors: technical depth, working code, honest problem statement
- Avoid: marketing language, superlatives, "revolutionary"
- Best posting time: ~10am ET on a weekday
- If Show HN: reply to own post with the first comment above
