# Twitter/X Thread — Lobster Academy Launch

---

**Tweet 1 (Hook)**

You wouldn't fly a plane without a black box.

Why are you running AI agents without one?

Open-sourcing Lobster Academy — an agent behavior evidence platform.

200+ sanitization patterns. 53 attack scenarios. Ed25519-signed evidence.

🦞 github.com/jiach72-oss/lobster-academy

---

**Tweet 2 (Problem)**

The problem nobody talks about:

Your agent just leaked a customer's SSN. Or hallucinated a legal opinion. Or got jailbroken.

What evidence do you have?

→ "Uh, the logs show…"
→ "We think it was the third prompt…"
→ "We're not sure what happened."

Not good enough.

---

**Tweet 3 (Feature 1: Recording)**

Lobster Academy records EVERYTHING:

• Every tool call with full I/O
• Every decision branch
• Every state change

Not text logs. Structured, queryable events you can replay step by step.

```ts
const session = box.startSession();
await agent.run(task, { hooks: session.recorder() });
const replay = session.replay();
```

---

**Tweet 4 (Feature 2: Sanitization)**

200+ built-in sanitization patterns.

SSNs, credit cards, API keys, emails, phone numbers, medical records — stripped BEFORE storage.

Not "we'll mask it later." Sanitized at write time.

Your compliance team will actually smile.

---

**Tweet 5 (Feature 3: Evaluation)**

5 dimensions. 25 metrics. One number.

┌─────────────────────────┐
│ Reliability  ████████░░ │
│ Safety       █████████░ │
│ Accuracy     ███████░░░ │
│ Efficiency   ████████░░ │
│ Robustness   ███████░░░ │
└─────────────────────────┘

Compare agents on the same scale. No more vibes-based assessment.

---

**Tweet 6 (Feature 4: Adversarial Testing)**

53 adversarial attack scenarios baked in:

• Prompt injection variants
• Jailbreak patterns
• Data exfiltration attempts
• Privilege escalation
• Context manipulation

Run them before you deploy. Not after.

---

**Tweet 7 (Feature 5: Signatures)**

Ed25519 digital signatures on every piece of evidence.

Cryptographic proof that nobody tampered with the record.

If it's ever going to court (or a SOC2 audit), you need this.

---

**Tweet 8 (Stats)**

📦 TypeScript SDK
🌐 Next.js 14 docs site
✅ 567 tests, all passing
📄 Apache 2.0 license
🌍 Bilingual docs (EN/CN)

No API keys needed. No cloud dependency. Just `npm install lobster-academy`.

---

**Tweet 9 (Comparison)**

How this differs from LangSmith/Braintrust:

• Those = LLM observability (tokens, latency, traces)
• This = Forensic evidence (sanitized, signed, replayable)

Different problem. Think "compliance officer" not "dashboard."

Both are needed. They complement each other.

---

**Tweet 10 (CTA)**

Star it if you run agents in production.
Open an issue if you want new attack scenarios.
PR if you want to add framework integrations.

Every agent deserves a black box. 🦞

github.com/jiach72-oss/lobster-academy
