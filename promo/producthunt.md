# Product Hunt Launch — Lobster Academy

## Tagline

Open-source black box for AI agents. Record. Sanitize. Prove.

## Short Description (60 chars)

AI agent behavior evidence platform — every agent deserves one

## Description

Lobster Academy is an open-source platform that gives AI agents what aircraft have had for decades: a flight data recorder.

When agents make decisions affecting real users, you need forensic evidence — not vibes, not grep through stdout, not "we think this happened."

### What it does:

🎯 **Behavior Recording** — Capture every tool call, decision, and output as structured, replayable events

🔒 **Data Sanitization** — 200+ patterns strip PII/secrets at write time, before storage. HIPAA/GDPR/SOC2 ready.

📊 **Capability Evaluation** — 5 dimensions × 5 metrics = 25 quantitative scores to compare agents on the same scale

⚔️ **Adversarial Testing** — 53 built-in attack scenarios: prompt injection, jailbreak, data exfil, privilege escalation

✍️ **Ed25519 Signatures** — Cryptographic proof your evidence hasn't been tampered with

### Quick Start:

```bash
npm install lobster-academy
```

```typescript
const box = new BlackBox({ agent: 'my-agent' });
const session = box.startSession();
await agent.run(task, { hooks: session.recorder() });
```

### Stats:
- 567 tests passing
- Apache 2.0 license
- TypeScript SDK + Next.js docs
- No cloud dependency

### Why it matters:
Every day more agents go into production. Every day the gap between "it works" and "we can prove it works safely" grows. Lobster Academy closes that gap.

## Maker's Comment

Hey PH! 👋

I built this because I kept seeing the same pattern: teams deploy agents, something goes wrong, and nobody can reconstruct what happened.

Existing tools (LangSmith, Braintrust) are great for observability — tokens, latency, traces. But when you need actual *evidence* — sanitized, signed, replayable proof of what your agent did — there wasn't a good open-source option.

Lobster Academy fills that gap. It's not a replacement for observability tools; it's a complement. Think of it as: observability = dashboard, Lobster Academy = evidence locker.

567 tests, Apache 2.0, no vendor lock-in. Would love your feedback, especially on the evaluation dimensions and attack scenarios.

Every agent deserves a black box. 🦞

## Topics / Categories

- Artificial Intelligence
- Open Source
- Developer Tools
- Security

## Gallery Images (suggestions)

1. Hero image: "Every agent deserves a black box" with lobster + black box illustration
2. Architecture diagram: Recorder → Sanitizer → Signer → Storage
3. Evaluation dashboard mockup showing 5 dimensions
4. Code snippet showing quick start
5. Adversarial test results visualization
