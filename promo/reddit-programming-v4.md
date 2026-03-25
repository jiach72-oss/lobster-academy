# r/programming — 个人开发者口吻（第四版）

**Title:**
```
TIL: sanitizing agent logs at write-time is way harder than it sounds (and regex is a trap)
```

**Body:**
```
So I've been debugging a mess for the past few weeks and figured I'd share some war stories in case anyone else is dealing with agent logging in production.

The short version: our agent was making decisions that affected real users, and when something went sideways, we had... nothing useful. Raw stdout dumps. PII mixed in with debug output. No way to know if someone had edited the logs after the fact. Classic "we'll add proper logging later" debt.

I started with what seemed obvious — just add regex patterns to strip sensitive stuff before storing logs. Sounds easy right?

It's not.

First problem: formatting. A credit card can be `4111-1111-1111-1111` or `4111 1111 1111 1111` or `4111111111111111`. AWS keys start with `AKIA` and are 20 chars after that. But OpenAI keys start with `sk-`. GitHub tokens are `ghp_` followed by 36 chars. Each one needs its own pattern, and each pattern has edge cases that produce false positives.

The one that really got me: Chinese phone numbers. They look like regular long numbers, and if you strip them aggressively you end up redacting random numeric data. I had a test case where a product price of ¥1,380,013,800 got nuked because it matched a phone number pattern. Took me two days to figure out why my test data kept getting mangled.

I ended up building a multi-pass approach — normalize whitespace first, then match patterns with context scoring. A 16-digit number next to "card" or "payment" gets flagged. The same number next to "product_id" doesn't. It's not perfect but it's way better than raw regex matching. The pattern catalog is around 200 entries now and I still find gaps regularly.

Second rabbit hole: tamper-proofing the logs. We have compliance requirements (SOC2) and our auditor asked "how do you know these logs haven't been modified?" Good question.

My first thought was hash chains, like git does it. Simple, but if any link breaks, everything after it is suspect. Then I looked at RSA signing — works but the signatures are huge and it's slow when you're logging thousands of events per session.

Ended up going with Ed25519. 64-byte signatures, fast, and the tweetnacl-js library is pure JS with no native deps so it runs everywhere. The trick that took me a while to figure out: don't just sign individual events. Sign each event, then sign a manifest of all the event hashes. That way you can verify individual events independently, but tampering with anything invalidates the session-level proof.

The key management is still a headache honestly. If the signing key gets compromised, all your evidence is garbage. I'm storing keys separately from evidence but haven't found a clean solution for key rotation that doesn't break historical verification.

Third thing that surprised me: adversarial testing is way more useful when you chain attacks together. Testing "can I prompt inject this agent" in isolation is fine, but real attacks are multi-step. First you confuse the agent into partial compliance, then you use that foothold for data exfil. I built a simple composable attack runner where each attack is just a function that takes an agent handler and returns results, and you can chain them. Found three vulnerabilities that way that single-vector testing completely missed.

Oh and MongoDB was a mistake for storing evidence. Needed ACID transactions. A partial evidence record is worse than no record because you think you have data when you don't. Switched to Postgres.

Anyway, curious if anyone else has dealt with agent forensics. The key rotation problem especially — would love to hear how others handle it.
```
