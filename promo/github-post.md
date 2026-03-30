# 🦞 Lobster Academy — Open Source Project Showcase

## What is it?

**Lobster Academy** is an open-source AI Agent behavior evidence platform. Think of it as a flight data recorder for your AI agents.

**GitHub:** https://github.com/jiach72-oss/lobster-academy
**License:** Apache 2.0
**Slogan:** Every agent deserves a black box.

---

## The Problem

When an AI agent does something unexpected — leaks data, hallucinates wildly, or makes a bad decision — most teams have zero forensic evidence. No playback. No audit trail. No accountability.

You wouldn't fly a plane without a black box. Why run agents without one?

## What it does

- **Behavior Recording** — Captures every tool call, decision branch, and output with full context replay
- **Data Sanitization** — 200+ built-in patterns to strip PII, secrets, and sensitive data before storage (HIPAA, GDPR, SOC2 friendly)
- **Capability Evaluation** — 5 dimensions, 25 quantitative metrics to score your agent's actual abilities vs. claims
- **Adversarial Testing** — 53 attack scenarios (prompt injection, jailbreak, data exfil, privilege escalation) to stress-test agents
- **Ed25519 Signatures** — Cryptographic proof that the recorded evidence hasn't been tampered with

## Quick Start

```bash
npm install lobster-academy
```

```typescript
import { BlackBox, Evaluator } from 'lobster-academy';

// Record agent behavior
const box = new BlackBox({ agent: 'my-agent' });
const session = box.startSession();

await agent.run("Summarize this report", {
  hooks: session.recorder()
});

// Replay the full session later
const replay = session.replay();
console.log(replay.timeline);
// → [{"step": 1, "tool": "read_file", "input": {...}, "output": {...}}, ...]

// Evaluate with 25 metrics across 5 dimensions
const score = await Evaluator.run(agent, {
  dimensions: ['reliability', 'safety', 'accuracy', 'efficiency', 'robustness']
});
console.log(score.report);
```

## Stats

- **567 tests**, all passing
- **200+** data sanitization patterns
- **53** adversarial attack scenarios
- **25** evaluation metrics across 5 dimensions
- **TypeScript SDK** + Next.js 14 documentation site
- **Bilingual** (English + Chinese docs)

## Why not just use logs?

Standard logging gives you text dumps. Lobster Academy gives you:

1. **Structured evidence** — Every action is a discrete, queryable event
2. **Privacy by design** — Sanitization happens *before* storage, not after a breach
3. **Cryptographic integrity** — Ed25519 signatures prove the evidence is unaltered
4. **Standardized evaluation** — Compare agents on the same 25 metrics, apples to apples
5. **Attack simulation** — Don't wait for a real attack; test against 53 known patterns

## We need contributors

Looking for help with:
- Additional sanitization patterns (especially industry-specific ones)
- New adversarial attack scenarios
- Integrations with popular agent frameworks (LangChain, CrewAI, AutoGen)
- Documentation improvements

**Star the repo** if this sounds useful. **Open an issue** if you have ideas. PRs welcome.

⭐ https://github.com/jiach72-oss/lobster-academy
