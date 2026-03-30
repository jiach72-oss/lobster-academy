# Reddit 三帖定稿

---

## 1. r/MachineLearning

**Title:**
```
[P] Open-source flight recorder for AI agents — behavior recording, 200+ sanitization patterns, 53 adversarial tests (Apache 2.0)
```

**Body:**
```
Hey r/MachineLearning,

I built Lobster Academy — an open-source platform that acts as a "black box" for AI agents.

The problem: when your agent misbehaves (leaks PII, hallucinates badly, gets jailbroken), most teams have vibes and logs. No structured evidence, no replay, no integrity guarantee.

What it does:

- Behavior recording — Full context replay of every tool call and decision
- Data sanitization — 200+ regex patterns strip PII/secrets before storage
- Capability evaluation — 5 dimensions, 25 metrics (reliability, safety, accuracy, efficiency, robustness)
- Adversarial testing — 53 attack scenarios including prompt injection, data exfiltration, privilege escalation
- Ed25519 signatures — Cryptographic proof your evidence hasn't been tampered with

Quick example:

import { BlackBox, Evaluator } from 'lobster-academy';

const box = new BlackBox({ agent: 'my-agent' });
const session = box.startSession();

await agent.run("Process user query", { hooks: session.recorder() });
const replay = session.replay();
const score = await Evaluator.run(agent);

Stats: 567 tests passing | Apache 2.0 | TypeScript SDK

GitHub: https://github.com/jiach72-oss/lobster-academy

Looking for feedback on the evaluation framework especially — is 5 dimensions / 25 metrics the right granularity? What are we missing?
```

---

## 2. r/LocalLLaMA

**Title:**
```
Spent weeks building write-time sanitization for agent logs. Regex is a trap. Here's what I learned.
```

**Body:**
```
Not posting a product, just sharing some hard-won lessons from debugging agent logging in production.

When our agent screwed up, we had nothing useful. Raw stdout dumps with PII mixed in. No way to replay decisions. No integrity guarantees. Classic "we'll add proper logging later" debt.

Sanitization at write-time sounds obvious. It's not.

A credit card can be formatted 3+ ways. AWS keys look nothing like OpenAI keys. GitHub tokens are different again. I'm at 200+ patterns and still finding gaps.

Best bug: a product price of ¥1,380,013,800 got redacted because it matched a Chinese phone number pattern. Took two days to figure out why my test data kept disappearing.

Solution was context scoring — a 16-digit number next to "card" or "payment" gets flagged. Same number next to "product_id" doesn't. Multi-pass pipeline: normalize whitespace first, then match with context weights.

Ed25519 for tamper-proofing: 64-byte signatures, fast, pure JS (tweetnacl-js). Sign each event, then sign a manifest of all hashes. Merkle-like structure so you can verify individually but tampering invalidates the session.

Biggest surprise: adversarial testing is way more useful when you chain attacks. Single vector testing found nothing. Chained attacks (confuse → partial compliance → data exfil) found 3 vulnerabilities.

MongoDB was a mistake for evidence storage. Needed ACID. Switched to Postgres.

Also open sourced the whole thing if anyone wants to poke around: https://github.com/jiach72-oss/lobster-academy

If you're running agents in production and dealing with similar logging issues, curious how you handle key rotation. That's the one problem I still don't have a clean answer for.
```

---

## 3. r/opensource

**Title:**
```
[Release] Lobster Academy — open-source AI agent behavior evidence platform (Apache 2.0, 567 tests)
```

**Body:**
```
Released Lobster Academy, an open-source platform for recording, evaluating, and stress-testing AI agents.

What it is:
- TypeScript SDK for agent behavior recording with data sanitization
- Evaluation framework: 5 dimensions, 25 metrics
- Adversarial testing: 53 attack scenarios
- Ed25519-signed evidence for tamper-proof audit trails

Why it's open source:
Agent accountability shouldn't be a proprietary black box (ironic, I know). If agents are making decisions in production, the evidence of how they decided needs to be open and verifiable.

Stats:
- Apache 2.0 license
- 567 tests passing
- TypeScript SDK + Next.js 14 docs site

Looking for:
- Contributors (especially for new sanitization patterns and attack scenarios)
- Framework integrations (LangChain, CrewAI, AutoGen)
- Feedback on the evaluation metrics

GitHub: https://github.com/jiach72-oss/lobster-academy

Stars appreciated but issues/PRs more so. 🦞
```
