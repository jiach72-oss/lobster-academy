# Lobster Academy — Landing Page Copy

## Hero Section

### Headline
**The Flight Recorder for AI Agents**
Record, redact, evaluate, and defend — before your Agent breaks production.

### Subheadline
Open-source SDK with 200+ redaction patterns, 5-dimension evaluation, and 53 attack scenarios. Ship AI Agents you can trust.

### CTA Buttons
- `⭐ Star on GitHub` → https://github.com/jiach72-oss/lobster-academy
- `🚀 Start Free →` (SDK download)
- `☁️ Try Cloud Dashboard` (Pro trial)

---

## Problem Section

### Your Agent is a black box. That's a problem.

- 🔥 **67% of AI teams** have shipped an Agent with a security vulnerability they didn't know about
- 💸 **$4.45M** — average cost of a data breach in 2024 (IBM)
- 🕐 **277 days** — average time to identify and contain a breach
- 🎯 **53 known attack vectors** target AI Agents today — how many does YOUR Agent defend against?

> "We didn't know our Agent was leaking PII until a customer complained."
> — Anonymous CTO, Series B SaaS startup

---

## Solution Section

### Three pillars of Agent safety

#### 🎥 Record — See everything your Agent does
Like a flight recorder for AI. Capture every tool call, every decision, every data flow. Replay any session to understand exactly what happened.

- Timestamped behavior logs
- Ed25519 signed audit trails (tamper-proof)
- Full session replay with context

#### 🛡️ Redact — Protect sensitive data automatically
200+ pattern engine catches PII, PHI, credentials, and secrets before they leak.

- Credit cards, SSN, API keys, medical records
- Custom regex patterns for your domain
- Configurable sensitivity levels

#### ⚔️ Defend — Test against 53 real attack scenarios
Don't wait for hackers. Attack your own Agent first.

- Prompt injection (direct & indirect)
- Jailbreak & roleplay attacks
- Data exfiltration attempts
- Tool abuse & privilege escalation

---

## Social Proof Section

### Built for teams shipping production AI

- **246 tests** passing — we eat our own dog food
- **TypeScript + Python** — works in your stack
- **Apache 2.0** — truly open source, no vendor lock-in
- **5 dimensions, 25 metrics** — the most comprehensive Agent evaluation framework

---

## How It Works Section

### Get started in 3 minutes

```bash
# Install
npm install lobster-academy
# or
pip install lobster-academy

# Record a session
import { Recorder } from 'lobster-academy';
const recorder = new Recorder();
recorder.start();

// Your Agent runs normally...

const session = recorder.stop();
console.log(session.auditTrail); // Ed25519 signed
```

---

## Product Hunt Specific

### Tagline
**The Flight Recorder for AI Agents — record, redact, evaluate, defend**

### Description (260 chars)
Lobster Academy is the open-source toolkit that makes AI Agents observable, safe, and auditable. 200+ redaction patterns, 53 attack scenarios, 5-dimension evaluation framework. TypeScript + Python. Like Datadog, but for Agent behavior.

### First Comment
Hey Product Hunt! 👋

We built Lobster Academy because we kept seeing the same pattern: teams ship AI Agents to production with zero observability. When something goes wrong (and it will), there's no black box to analyze.

So we built one.

**What it does:**
- 🎥 Records every Agent interaction with Ed25519-signed audit trails
- 🛡️ Redacts 200+ sensitive data patterns automatically
- ⚔️ Tests against 53 real-world attack scenarios
- 📊 Evaluates Agents on 5 dimensions with 25 metrics
- 🔧 Works with TypeScript AND Python

**Why it's open source:**
Agent safety shouldn't be a luxury. The core SDK is Apache 2.0 — use it in production, modify it, fork it. We make money on the cloud dashboard for teams that want historical data, alerting, and collaboration.

Would love your feedback! 🦞

---

## Target Audiences

### For Developers
"Finally, I can see what my Agent is actually doing."

### For CTOs
"Ship Agent features with confidence. Audit-ready from day one."

### For Security Teams
"53 attack scenarios, 200+ redaction patterns. We test so you don't have to guess."

### For Compliance Officers
"Ed25519-signed audit trails that satisfy SOC2, HIPAA, and GDPR requirements."
