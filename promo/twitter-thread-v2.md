# Twitter Thread — 个人开发者口吻

---

**Tweet 1**

Been debugging agent logging in production for weeks. War stories incoming 🧵

The tl;dr: when our agent screwed up, we had zero useful evidence. Raw stdout dumps. PII everywhere. No idea if logs were tampered with.

Three things I learned the hard way.

---

**Tweet 2**

Regex sanitization is a trap.

Sure, strip credit cards. Easy right? Except a card can be 4111-1111-1111-1111 or 4111 1111 1111 1111 or 4111111111111111.

AWS keys look nothing like OpenAI keys. GitHub tokens are different again. 200+ patterns later and I still find gaps every week.

---

**Tweet 3**

Best bug I found: a product price of ¥1,380,013,800 got redacted because it matched a Chinese phone number pattern.

Took me two days to figure out why my test data kept disappearing.

Context scoring saved me. A 16-digit number next to "card" = sensitive. Same number next to "product_id" = fine.

---

**Tweet 4**

SOC2 auditor asked: "how do you know these logs haven't been modified?"

Me: ...good question.

Hash chains break if any link fails. RSA signing is slow and signatures are huge.

Ed25519: 64-byte signatures, fast, pure JS library. Done.

---

**Tweet 5**

The trick that took me a while: don't just sign individual events.

Sign each event, then sign a manifest of all the hashes. Merkle-like structure.

You can verify events independently, but tampering with anything invalidates the session proof.

---

**Tweet 6**

Key rotation is still a headache and I don't have a clean answer.

If the signing key gets compromised, all your evidence is garbage. Storing keys separately from evidence helps but doesn't solve rotation without breaking historical verification.

If you've solved this, please tell me.

---

**Tweet 7**

Biggest surprise: adversarial testing is way more useful when you chain attacks.

Single vector: "can I prompt inject this agent?" Fine.

Real attacks: confuse agent → partial compliance → use foothold for data exfil.

Found 3 vulns with chained attacks that isolated testing completely missed.

---

**Tweet 8**

MongoDB was a mistake. Needed ACID transactions.

A partial evidence record is worse than no record because you think you have data when you don't. Switched to Postgres.

Also: single-score agent eval is useless. 80/100 could mean 99% safe / 60% accurate. You need separate dimensions.

---

**Tweet 9**

Open sourced the whole thing: github.com/jiach72-oss/lobster-academy

Apache 2.0. 567 tests. TypeScript.

But really this thread is about the problems, not the product. If you're dealing with agent forensics I'd love to hear how you handle key rotation.
