# r/programming — 纯技术讨论（第三版）

**Title:**
```
Three hard problems in AI agent forensics: write-time sanitization, evidence signing, and composable adversarial testing
```

**Body:**
```
I've been thinking about a class of problem that doesn't get enough attention: when an AI agent in production does something wrong — leaks data, hallucinates dangerously, gets jailbroken — how do you reconstruct what happened in a way that's forensically sound?

Standard logging doesn't cut it. You get unstructured text dumps, raw PII sitting in plaintext, no integrity guarantees, and no way to replay the actual decision chain. I spent some time working through three specific sub-problems and wanted to share what I learned.

**Problem 1: When do you strip PII from agent logs?**

The naive approach is log everything raw, mask at query time. But "query time" often means "after someone's already seen the raw data" or "never, because we forgot."

Write-time sanitization is the alternative — strip sensitive data before it ever hits durable storage. The engineering challenge is pattern coverage vs. false positives.

Credit card numbers have 3+ common formatting variants. A 16-digit number next to "card" is probably sensitive; the same number in a product SKU isn't. API keys have wildly different formats across providers — AWS keys look nothing like OpenAI keys, which look nothing like GitHub tokens.

I ended up building a multi-pass pipeline: normalize whitespace first, then apply pattern matching with contextual scoring. Each pattern carries a confidence weight and false-positive rate. The catalog grew to 200+ patterns across categories like PII, cloud credentials, database connection strings, and AI platform keys.

The surprising finding: the hardest category wasn't API keys (they have predictable formats) — it was Chinese ID numbers and phone numbers, which have regional formatting variants that overlap with other numeric data.

**Problem 2: How do you prove log evidence hasn't been tampered with?**

If agent decisions might end up in a compliance audit (SOC2, GDPR, HIPAA) or worse, litigation, you need cryptographic proof of integrity.

I explored three approaches:

- **Hash chains** (like git): Simple but fragile. Any break in the chain invalidates everything after it.
- **RSA signing**: Works but signatures are large (256+ bytes for RSA-2048) and slow for high-volume event streams.
- **Ed25519**: 64-byte signatures, fast verification, no native dependencies needed (tweetnacl-js is audited and pure JS).

The design that worked best: sign each event individually with a session-scoped keypair, then sign a session manifest containing all event hashes. This gives you a Merkle-like structure — you can verify individual events without trusting the full chain, but tampering with any event invalidates the session signature.

Key rotation is the next headache. You need keypairs that outlive the evidence, which means secure key storage separate from the evidence store. If the signing key is compromised, all your evidence is worthless.

**Problem 3: How do you make adversarial attacks composable?**

Most agent testing frameworks test happy paths or individual attack vectors in isolation. Real attackers chain exploits — first compromise the agent's behavior, then use that compromised state to exfiltrate data.

I prototyped a composable attack framework where each attack is a function: `(agentHandler) => AttackResult`. You run them sequentially, and each attack can read context from previous failures.

Example chain:
```
1. Direct prompt injection → agent resists
2. Indirect injection via tool output → agent resists  
3. Role confusion attack → agent partially complies
4. Using partial compliance, attempt data exfil → succeeds
```

This reveals multi-step vulnerabilities that isolated testing misses. The tricky engineering problem is state management — each attack needs to see the cumulative effect of previous attacks on the agent's internal state, not just its external outputs.

**What didn't work:**

- MongoDB for evidence storage — you need ACID transactions. A partial evidence record is worse than no record because it creates false confidence.
- Single-score agent evaluation — hides critical tradeoffs. An agent scoring 80/100 might have 99% safety but 60% accuracy, which is a completely different risk profile than 60% safety and 99% accuracy. Five separate dimensions (reliability, safety, accuracy, efficiency, robustness) with sub-metrics turned out to be the minimum useful granularity.

Curious if others have tackled similar problems — especially the key management angle for long-lived evidence stores.
```
