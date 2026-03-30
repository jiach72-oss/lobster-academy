# r/programming — 技术深度文章（符合 Rule 6）

**Title:**
```
How to build tamper-proof evidence for AI agents — sanitization at write-time, Ed25519 signing, and adversarial testing
```

**Body:**
```
We ran into a problem deploying AI agents in production: when something goes wrong, you have no reliable evidence of what the agent actually did. Logs are unstructured, easy to tamper with, and often contain raw PII that shouldn't be stored.

We ended up building a pipeline with three non-obvious design decisions that might be useful to others facing the same problem.

**1. Sanitization at write-time, not read-time**

The instinct is to store everything raw and mask later. But "later" never happens, and a single log leak exposes everything. We sanitize *before* the data hits storage — 200+ regex patterns for PII, API keys, cloud credentials, etc.

The tricky part: regex alone isn't enough. A credit card pattern catches `4111-1111-1111-1111` but not `4111 1111 1111 1111` or `4111111111111111`. We had to build a multi-pass pipeline that normalizes whitespace, then applies contextual matching (a 16-digit number near the word "card" is more likely sensitive than one in a product ID).

The pattern catalog itself is interesting — we ended up with patterns for 200+ formats across PII (SSN, passport, ID card), cloud keys (AWS, GCP, Azure, GitHub tokens), database connection strings, and AI platform keys (OpenAI, Anthropic). Each pattern has a confidence score and false-positive rate.

**2. Ed25519 signing for chain of custody**

If evidence might end up in a compliance audit (SOC2, GDPR, HIPAA), you need to prove it hasn't been tampered with. We chose Ed25519 over RSA because of signature size (64 bytes vs 256+ for RSA-2048) and speed.

The implementation challenge was key management for replay scenarios. We generate a keypair per evidence session, sign each event individually, then sign the session manifest (which contains all event hashes). This creates a Merkle-like chain — altering any single event invalidates the session signature.

We use tweetnacl-js for the Ed25519 implementation because it's audited and has no native dependencies. Pure JavaScript, works in Node and edge runtimes.

```typescript
// Simplified signing flow
const keyPair = nacl.sign.keyPair();
const eventHash = sha256(JSON.stringify(event));
const signature = nacl.sign(eventHash, keyPair.secretKey);

// Verification: anyone with the public key can verify
const isValid = nacl.sign.open(signature, keyPair.publicKey);
```

**3. Adversarial testing as a first-class feature**

Most agent testing is happy-path. We built a framework of 53 attack scenarios based on real-world incidents: prompt injection variants, jailbreak patterns, data exfiltration attempts, privilege escalation, context manipulation.

The interesting engineering problem was making attacks composable. Each attack is a function that takes an agent handler and returns a structured result. You can chain them: first attempt a jailbreak, then if the agent is compromised, try data exfiltration. This simulates real multi-step attacks.

```typescript
// Each attack returns { passed, evidence, severity }
const attacks = [
  PromptInjection.direct(),
  PromptInjection.indirect(),
  Jailbreak.danVariant(),
  DataExfil.toolAbuse(),
  PrivilegeEscalation.roleConfusion(),
];

// Run sequentially — each can use context from previous failures
const report = await runAttackChain(agent, attacks);
```

**What we got wrong initially:**

- Started with MongoDB for storage — switched to PostgreSQL because we needed ACID transactions for evidence integrity (you can't have a partial evidence record)
- First version stored sanitization as post-processing — moved it to write-time after a breach drill showed raw data sitting in staging environments
- Tried to build evaluation metrics as a single score — realized you need 5 separate dimensions (reliability, safety, accuracy, efficiency, robustness) because a single number hides tradeoffs

Open source (Apache 2.0), 567 tests, TypeScript: https://github.com/jiach72-oss/lobster-academy

Happy to discuss the architecture decisions or tradeoffs we made.
```
