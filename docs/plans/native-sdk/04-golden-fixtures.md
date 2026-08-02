# Golden fixtures — the cross-platform conformance corpus

A committed set of language-agnostic JSON vectors that three independent
implementations — TypeScript, Kotlin, Swift — must all reproduce byte for byte.

[`03-implementation-strategy.md`](./03-implementation-strategy.md) §1.6 decides *that*
we do this and why it replaces a shared core. This document is the operational half:
what the corpus contains, where each part lives, how to regenerate it, how each platform
consumes it, and the rules that keep it trustworthy.

---

## 1. Why the corpus exists

We ship two hand-written native codebases and no shared core. That decision is argued in
full in `03` §1.1–§1.5 — the short version is that the generated Swift from a Kotlin
Multiplatform core is not shippable to third parties, each Kotlin/Native framework
embeds a multi-megabyte runtime against a **< 150 KB** budget, and two such frameworks in
one merchant app collide at runtime in a way that looks like the merchant's bug.

Rejecting a shared core leaves a real problem: three implementations of the same
deterministic logic will drift. **The corpus is the named alternative** — promoted in
`03` §1.6 from a testing note to the mechanism that carries the guarantee a shared core
would have carried.

The prior art is explicit. This is Slack's post-LibSlack conformance-suite pattern, and
`twitter-text` is the canonical example — a corpus consumed by independently maintained
Java, Kotlin, Swift and JS implementations, whose stated philosophy is that *"anyone can
feel free to implement this logic however they choose."* **Vectors are the contract; the
implementation is not.**

The failure this prevents is not hypothetical. iOS and Android produce *different output
for identical locale and currency input* — `"CHF 10.00"` against `"CHF10.00"` for the
same `en-US`/CHF pair — and ICU version skew produces divergence within a single platform
family. "Just use the platform formatter" is not available to us.

---

## 2. The three concerns, and where each lives

Three areas need byte-identical behaviour across platforms. All three are pure
computation with no platform API dependency, which is exactly what makes them portable
and exactly what makes drift silent.

| Concern | Fixture file | Generator | Entries |
|---|---|---|---|
| Identity — the signed byte layout for `merge`/`ensure`/`install`/`sso` | `sdk/core/src/identity/fixtures/golden-proofs.json` | `sdk/core/scripts/generate-golden-proofs.ts` | 6 |
| FrakContext v2 codec | `sdk/core/src/context/fixtures/golden-context.json` | `sdk/core/scripts/generate-golden-context.ts` | 32 |
| Reward selection and currency formatting | `sdk/core/src/rewards/fixtures/golden-rewards.json` | `sdk/core/scripts/generate-golden-rewards.ts` | 67 |

**Identity** covers `op ‖ merchantId(16) ‖ anonymousId(16) ‖ binding(32) ‖ ts(8)` — fixed
width throughout, no length prefixes, UUIDs as their raw 16 bytes rather than their
36-character text form, `ts` as `uint64be` Unix seconds, and a `binding` that is always
exactly 32 bytes, zero-filled when the op does not use it, so the layout never varies by
op. The frozen module is `sdk/core/src/identity/canonical.ts`, deliberately crypto-free
so the SDK signer and the backend verifier build on one artifact. This half arrived from
the identity work rather than from native, and made the same call this document does.

**Codec** covers big-endian `uint32` timestamps, unpadded base64url, and length-based
version disambiguation. Entries carry `kind: "encode" | "reject"` — positive vectors with
expected output, and negative vectors naming input that must be refused, with `direction`
(`encode`/`decode`/`decompress`) and `reason`.

> **Correction to `03` §1.6.** That section describes the codec as "lowercase-only
> UUIDs", which reads as *rejects uppercase*. It does not. The V2 regex is
> case-insensitive: an uppercase merchant or client UUID encodes to byte-identical output
> as its lowercase form, and decode always emits lowercase canonical. Same for wallet
> addresses — mixed-case hex is accepted and normalised on decode. It is
> **normalise-on-decode, not reject**, pinned by the `uppercase-uuid-normalised` fixture
> and verified by execution. The identity corpus independently carries the same lesson,
> in its "uppercase merchantId parsed to the same 16 bytes as lowercase" entry. Two
> concerns landing on normalise-not-reject is the corpus doing its job.

**Rewards** covers six functions, named by each entry's `kind`:

| `kind` | Entries |
|---|---|
| `format-amount` | 16 |
| `format-estimated-reward` | 14 |
| `reward-value` | 11 |
| `select-display-campaign` | 10 |
| `select-best-reward` | 9 |
| `format-reward-or-hide` | 7 |

The three `format-*` kinds are the ones with a hazard attached — see §7.

**One corpus, not three.** Three separately-invented corpora would be three chances to
disagree about encoding, file layout and ownership — the exact divergence the mechanism
exists to prevent. The files are split by concern, but the envelope, the generator
conventions and the loaders are shared.

---

## 3. The envelope

Every file in the corpus has the same top-level shape. This is the contract between the
generators and the platform loaders, and it is deliberately minimal.

```json
{
    "formatVersion": 1,
    "fixtures": [
        { "name": "...", "description": "...", "kind": "...", "...": "payload" }
    ]
}
```

| Field | Rule |
|---|---|
| `formatVersion` | JSON integer, currently `1`. Identical across all three files. Not a string, not `1.0`. |
| `fixtures` | Non-empty array of objects. Nothing else is required at the top level. |

**The envelope is the only cross-team contract.** Everything inside an entry is payload,
owned by the concern that generates it, and both loaders treat it as opaque. This is what
lets the rewards corpus add a `kind` or the codec corpus add a `direction` without
touching a line of Kotlin or Swift.

Payload conventions, which are strong but enforced by each generator's own suite rather
than by the loaders:

| Field | Rule |
|---|---|
| `name` | Unique lowercase-kebab slug. **The id — key on this.** |
| `description` | Free prose for humans. Not unique, never keyed on. |
| `kind` | Per-concern discriminator naming what the entry exercises. |

`name` is required for **new** fixture groups. `golden-proofs.json` predates the
convention and carries only `description`; it is the grandfathered exception and gains a
`name` whenever it is next regenerated. That is precisely why `name` is a payload field
and not an envelope field — making it envelope-level would break the one file that has
existed longest.

**When to bump `formatVersion`:** when the *envelope* changes shape, which requires every
loader to be revisited. A payload gaining a field is routine and needs no bump — that is
the whole point of the split.

---

## 4. Regenerating

From the repo root:

```bash
bun run --cwd sdk/core fixtures:generate           # identity  → golden-proofs.json
bun run --cwd sdk/core fixtures:generate:context   # codec     → golden-context.json
bun run --cwd sdk/core fixtures:generate:rewards   # rewards   → golden-rewards.json
```

Each generator derives its vectors from the frozen `sdk/core` module it covers, and each
is also exposed as a package export (`@frak-labs/core-sdk/identity/fixtures` and
siblings) so the TypeScript suite consumes the same bytes the native suites do rather
than a parallel copy.

---

## 5. The rules that make the corpus worth having

### 5.1 Fixtures are generated and NEVER hand-edited

A hand-edited fixture is indistinguishable from a generated one by inspection, and it
silently converts the corpus from *"what the reference implementation does"* into *"what
someone once believed it should do."*

The failure mode is specific and nasty. A native suite fails; the expected value looks
slightly off; someone edits the JSON until it passes. The corpus now encodes the bug, and
because all three platforms assert against the same corpus, **all three go green while
being wrong together.** The mechanism has not just failed, it is now actively laundering
the defect.

If a fixture is wrong, the *generator* or the *frozen module* is wrong. Fix that, and
regenerate.

There is a second, quieter reason in the rewards corpus specifically. Some entries record
the same expected value twice — a literal and its codepoint array (§7.2) — and the two are
kept in agreement *only* by the generator writing both from one source string. A hand-edit
updates one and not the other, and the pair silently stops meaning anything. A corpus-wide
invariant test catches that, but it catches it *after* the fact; the rule is what prevents
it. See §7.3, which is where the temptation actually shows up.

### 5.2 The corpus must be byte-deterministic

Regenerating with no semantic change must produce a **zero diff**. No timestamps, no
absolute paths, no randomness, no locale-dependent host state. Every input is hardcoded;
where a fixture needs a time it uses a fixed epoch constant that is part of the encoded
wire data, not generation metadata.

This is not tidiness. Determinism is what makes the diff readable, and a readable diff is
the only review signal that exists here. If a regeneration always produced noise, a real
one-byte change to an expected value would be invisible in the churn — and a one-byte
change to an expected value is exactly the event the corpus exists to catch.

### 5.3 The determinism requirement, and the trap underneath it

There is a deeper reason, and it is the one worth internalising:

> **A round-trip test passes when both sides are identically wrong.**

`encode(decode(x)) == x` holds perfectly for an implementation that misreads the
timestamp as little-endian, as long as it also *writes* it little-endian. Same for a
codec that pads its base64url, or one that uppercases a UUID on the way in and lowercases
on the way out. The property is self-consistent and proves only internal consistency —
which is exactly the property that does **not** transfer across an implementation
boundary.

The corpus asserts against **externally fixed expected bytes**, produced once by the
reference implementation and frozen. That is what makes it a conformance suite rather
than a self-check. It is also why the generators must not derive expected values by
running the same code path the tests will run: the expected value has to be an
independent statement of truth, not an echo.

The corollary — recorded in `03` §6.3 question 5 — is that **a fixture set that has never
failed has not been shown to work.** Introduce a deliberate one-byte error in one
platform's codec and confirm the suite goes red. Until that has happened, the corpus is
an assumption.

---

## 6. How each platform consumes it

The corpus lives in `sdk/core`, which is **outside** both native projects. Neither
Gradle test resources nor SwiftPM's `Bundle.module` can reach it, so both loaders walk
up the filesystem to the repository root.

The root is identified by `sdk/core` **plus** a repo marker (`.git` or `package.json`)
together — `sdk/core` alone would match a stray directory, and `.git` alone breaks in a
git worktree or a CI checkout that trims it.

| | Android | iOS |
|---|---|---|
| Loader | `sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/fixtures/GoldenFixtures.kt` | `sdk/ios/Tests/FrakSDKTests/Fixtures/GoldenFixtures.swift` |
| Parser | `org.json`, **test scope only** | `JSONSerialization` (Foundation) |
| Walk starts at | the loaded class's `codeSource` location | `#filePath` |
| Test framework | JUnit 4 | Swift Testing (`@Suite`/`@Test`/`#expect`) |

### 6.1 Failing loudly is the whole design

Both loaders throw — with the missing path, the resolved repo root, and the regeneration
command — when a file is absent, is not valid JSON, has the wrong `formatVersion`, or has
an **empty** `fixtures` array.

Never skip. **A fixture suite that silently passes when the corpus is absent is worse
than no suite:** it reports the same green as a real run while asserting nothing, so a
corpus deleted by a bad merge is indistinguishable from a corpus that passes. The empty
-array check is the same failure one step further in — an empty corpus parses cleanly and
asserts nothing.

Both loaders have a test that deliberately requests a nonexistent file and asserts the
failure is loud and names the fix. The failure path is a feature, so it is tested rather
than assumed.

### 6.2 Why `org.json`, and a trap worth recording

The SDK's zero-third-party-runtime-dependency rule (`02` §5) is not in tension with a
test-only parser, but the Gradle configuration matters: `org.json` is declared
`testImplementation`, so it never reaches `components["release"]` and cannot appear in
the published POM. That is verified — `generatePomFileForReleasePublication` contains no
`org.json` entry.

**The trap:** "org.json ships with Android, so no dependency is needed" is wrong in a way
that compiles. It *is* on the classpath — but for local unit tests that classpath is the
stubbed `android.jar`, whose every method body throws:

```
java.lang.RuntimeException: Method getInt in org.json.JSONObject not mocked.
```

So the no-dependency version compiles cleanly and fails at runtime. The real
`org.json:json` artifact in test scope shadows the stub. This was established by
executing it, not by reading about it — and it is recorded here because the next person
to "clean up an unnecessary dependency" will otherwise rediscover it the slow way.

The alternatives, and why not:

| Option | Verdict |
|---|---|
| **kotlinx-serialization** | A new dependency *and* a Gradle plugin, and the plugin applies a compiler plugin to the whole module rather than to test source only. Disproportionate for parsing three files in test scope. |
| **Hand-rolled parsing** | No dependency — but hand-written JSON parsers get string escapes wrong, and this corpus is *specifically about invisible characters* (`\u202f`, `\u00a0`). A subtly wrong `\u` path would corrupt the exact bytes the fixtures exist to protect, silently. Writing a parser to check the thing parsers are worst at is the wrong trade. |
| **`org.json` (chosen)** | Public domain, no transitive dependencies, already familiar to every Android developer, test-scoped. |

Swift has no equivalent question — `JSONSerialization` is in Foundation, so `Package.swift`
gains nothing. `JSONSerialization` rather than `JSONDecoder` is deliberate: `Codable`
structs would type the payload, and typing the payload is precisely what makes every
payload change a change to the loader.

### 6.3 What the suites assert today

One example assertion per platform, against `golden-proofs.json` — the file guaranteed to
exist. Each proves the corpus loads, declares `formatVersion` 1, is non-empty, and that
entries really parsed.

There are deliberately **no assertions about SDK behaviour**, because none of the
identity, codec or reward code exists yet. Asserting against absent behaviour would
manufacture the appearance of coverage. What must be verified now is that the corpus can
be found and parsed from a real Gradle test JVM and a real `swift test` process — the
environment-dependent part, and the part that would otherwise be discovered much later.

**The conformance suites land with the code they cover.** When the codec ships, its suite
iterates `golden-context.json` and asserts real behaviour; the loader is already there.

One instruction for whoever writes the rewards suite on either platform: **assert
`formattedCodepoints` before `formatted`.** The TypeScript suite already orders them that
way, and the reason is in §7.2 — get the diagnosable failure to fire first.

---

## 7. The ICU and invisible-character hazard

This applies to the reward-formatting fixtures and is the single most likely source of a
confusing failure in the whole corpus.

### 7.1 What ICU actually emits

Currency formatting output is full of characters that are invisible in every diff viewer
and most editors:

| Codepoint | Name | Where |
|---|---|---|
| `U+00A0` | NO-BREAK SPACE | fr-FR, before the `€` |
| `U+202F` | NARROW NO-BREAK SPACE | fr-FR, thousands separator on modern ICU |
| `U+2212` | MINUS SIGN — not ASCII `-` | negative amounts in many locales |
| `U+200E` / `U+200F` | directional marks | around currency symbols in RTL locales |

A single fr-FR string above 1000 contains **two different invisible spaces**, and they
are not interchangeable.

### 7.2 What the corpus does about it

**The file is pure ASCII.** The generator post-processes its output so every codepoint
above `U+007F` is written as a `\uXXXX` escape — `\u00a0`, `\u202f`, `\u20ac`, `\u00a3`.
This is a property of the corpus that any future generator **must preserve**, not an
incidental detail. It is what makes the file safe to open in any editor and impossible
for a whitespace-trimming editor to silently corrupt.

**Every expected string is recorded twice.** Once as the escaped literal and once as an
explicit codepoint array under the same name plus a `Codepoints` suffix:

```json
{
    "name": "format-amount-eur-decimals",
    "kind": "format-amount",
    "amount": 1234.56, "currency": "eur", "locale": "fr-FR",
    "formatted": "1\u202f234,56\u00a0\u20ac",
    "formattedCodepoints": [
        "U+0031", "U+202F", "U+0032", "U+0033", "U+0034",
        "U+002C", "U+0035", "U+0036", "U+00A0", "U+20AC"
    ]
}
```

That entry is the trap in one line: `U+202F` as the group separator and `U+00A0` before
the `€`, two *different* invisible spaces in the same string.

**Pairs are not all top-level.** There are 43 of them across the rewards corpus, and 9 sit
nested inside a fixture's `best` object — including `minPurchaseAmount` /
`minPurchaseAmountCodepoints` on `best-reward-tiered`, which holds the fr-FR
`1 500 €`. That one is both at-risk *and* the pair least likely to be noticed by eye.
Anything walking these pairs must recurse, not just read the top level of each entry.

**Check the codepoint array BEFORE the literal**, so the readable failure is the one that
fires first. Assert the literal too — it is the real expected value — but the codepoint
array is what makes a failure diagnosable.

> **`formattedCodepoints` is not duplication and must not be collapsed.** It looks
> exactly like redundant data that a future reader would delete while believing they were
> tidying up.

This is not a prediction. A `U+202F` → `U+00A0` substitution was deliberately injected
into `formatAmount` and the suite run. The literal assertion reported:

```
AssertionError: expected '1 000 €' to be '1 000 €'
Expected: "1 000 €"
Received: "1 000 €"
```

Two visually **identical** strings — the afternoon-losing failure, exactly as feared. The
codepoint assertion, on the same injected defect:

```
AssertionError: expected [ 'U+0031', 'U+00A0', 'U+0032', …(7) ] to deeply equal
                         [ 'U+0031', 'U+202F', 'U+0032', …(7) ]
-   "U+202F"
+   "U+00A0"
```

That transcript is the argument against any future "delete the duplicate field" cleanup.

**The pairing is a generator invariant with no representation in the artifact.** Nothing
in the JSON states that `formatted` and `formattedCodepoints` must agree; they are written
from one source string and nothing downstream re-checks them. So the corpus carries a
corpus-wide invariant test that walks the whole `fixtures` tree, pairs any string field
`X` with a sibling `XCodepoints` at any depth, and asserts a floor on the number of pairs
found — so the walker cannot silently match nothing and pass. A generic walk rather than a
per-kind one, so pairs added by a future generator are covered without anyone remembering
to extend the test.

That test was itself verified against the real failure mode: one literal was hand-edited
to swap `U+202F` for `U+00A0` while leaving its codepoints stale — exactly the move §7.3
warns about — and it failed naming both the JSON path and the codepoint:

```
AssertionError: expected { at: 'fixtures[2].formatted', …(1) } to deeply equal
                         { at: 'fixtures[2].formatted', …(1) }
-     "U+202F"
+     "U+00A0"
```

Once the Kotlin and Swift rewards suites assert both fields per §6.3, they become a second
and third enforcement point, and a desynced pair fails on every platform rather than
passing quietly on two.

### 7.3 The fr-FR fragility, concretely

Covered locales are exactly three, all LTR, from `sdk/core/src/constants/locales.ts`
(`getSupportedCurrency` falls everything else back to `eur`, so this is the complete set
the SDK can emit):

| Currency | Locale | At risk? |
|---|---|---|
| `eur` | fr-FR | **Yes, for values ≥ 1000** |
| `usd` | en-US | No — ASCII `,` `.` `$` |
| `gbp` | en-GB | No — ASCII `,` `.` `£` |

The corpus was generated under **ICU 74.2**, where fr-FR uses `U+202F` as the thousands
separator and `U+00A0` before the `€`. The `U+202F` group separator arrived in
**CLDR 34 / ICU 63**. Older data emits `U+00A0` in that position instead — and Android
below roughly API 28 ships pre-ICU-63 CLDR data.

**So a device on an old API level produces `U+00A0` where the fixture says `U+202F`, and
fails for a reason that is nobody's bug.** Blast radius is precise: fr-FR fixtures whose
value is ≥ 1000, i.e. the ones with a group separator. fr-FR values under 1000 contain
only the `U+00A0` before `€`, which has been stable far longer.

**Exactly six entries carry a `U+202F`**, and they are the entire at-risk set — verified
by scanning the committed file, not estimated:

| Fixture `name` | Why |
|---|---|
| `format-amount-eur-decimals` | `1 234,56 €` |
| `format-amount-eur-large` | group separator |
| `format-amount-eur-rounds` | group separator |
| `format-amount-default-currency` | falls back to `eur`/fr-FR |
| `estimated-fixed-large` | group separator |
| `best-reward-tiered` | `minPurchaseAmount` of `1 500 €` |

Everything else in the corpus is ASCII-separator or sub-1000 fr-FR. If a failure names a
fixture outside that list, the group-separator hypothesis is wrong and it is a real bug.

**Treat a `U+202F` vs `U+00A0` group-separator mismatch as an ENVIRONMENT finding, not a
code defect.** Report the runtime ICU/CLDR version. The codepoint array makes that
diagnosis immediate.

> **This is the moment the temptation to hand-edit arrives, and it is the worst possible
> moment to give in to it.** A fr-FR fixture failing on an old API level looks like a
> wrong expected value, and the natural wrong move is to edit the JSON until it passes.
>
> That move has a second failure hidden inside it. `formatted` and `formattedCodepoints`
> are kept in sync only by the generator writing both from one source string. Someone
> hand-correcting a failure will update the literal and almost certainly not the
> codepoint array — and the pair silently stops meaning anything, taking the one
> diagnostic that makes these failures readable down with it.
>
> The rule from §5.1 applies with full force here: **regenerate, never hand-edit.** If the
> expectation is genuinely wrong, the generator is wrong.

Two consequences already baked in:

- **No negative-amount fixtures.** fr-FR negatives are a second, independent axis of ICU
  drift — ASCII `U+002D` against `U+2212`. ICU 74.2 currently emits `U+002D`, but the
  corpus should not be asserting that cross-platform. This is a deliberate, reasoned
  exclusion; do not "fill the gap" without reading this paragraph.
- **No RTL locales**, so no directional marks anywhere in this corpus today. Adding
  Arabic would introduce `U+200E`/`U+200F` and needs this section revisited first.

The ICU baseline — **generated under ICU 74.2 / CLDR 44** — lives in a comment in the
generator source, never in the JSON, which would break byte-determinism across machines.
The fr-FR expectations are only interpretable against a known baseline.

Determinism is not assumed here either: the rewards corpus was regenerated 20 consecutive
times and once more after deleting the file outright, byte-identical every time.

---

## 8. Adding a new fixture group

1. **Freeze the module first.** A corpus over logic that is still moving generates churn
   rather than a contract. The thing being pinned has to be worth pinning.
2. **Write the generator** at `sdk/core/scripts/generate-golden-<concern>.ts`, emitting
   to `sdk/core/src/<concern>/fixtures/golden-<concern>.json`. Add a
   `fixtures:generate:<concern>` script to `sdk/core/package.json`, and a package export
   so the TypeScript suite reads the same bytes rather than a parallel copy.
3. **Match the envelope** — `formatVersion: 1` and `fixtures`, nothing else at the top
   level. Give every entry a unique kebab-case `name`, a human `description`, and a `kind`
   discriminator. Match the existing files' 4-space indent and trailing newline so the
   formatter does not fight you.
4. **Guarantee determinism.** No timestamps, no paths, no randomness. Run the generator
   twice and confirm a zero diff — that is the acceptance test for this step.
5. **Escape non-ASCII** as `\uXXXX` if the payload can contain any, and add a codepoint
   array alongside any string where invisible characters are possible. Name it after the
   field plus a `Codepoints` suffix, so the corpus-wide sync invariant (§7.2) picks it up
   automatically — including nested ones, which it finds by recursing.
6. **Assert `name` uniqueness in your own suite.** The loaders validate the envelope
   only; payload invariants belong to the generator that owns them.
7. **Consume it** — add a constant to both loaders (`GoldenFixtures.CONTEXT_CODEC` and
   `GoldenFixtures.contextCodec` are the pattern) and write the conformance suite
   alongside the platform code it covers. No loader changes are needed; entries arrive as
   raw JSON objects.
8. **Prove it fails.** Break one byte in one platform deliberately and watch it go red
   before you trust it.

---

## 9. Status

| | State |
|---|---|
| Envelope | Agreed and locked across all three files — `formatVersion` 1 + `fixtures` |
| `golden-proofs.json` | 6 entries, shipped with the identity work |
| `golden-context.json` | 32 entries — 11 `encode`, 21 `reject` |
| `golden-rewards.json` | 67 entries across 6 `kind`s, carrying 43 literal/codepoint pairs |
| Kotlin loader | Green — parses all three files, `bun run --cwd sdk/android test` |
| Swift loader | Green — parses all three files, `bun run --cwd sdk/ios test` |
| Conformance suites | **Not written.** No SDK behaviour exists to conform yet (`03` §7). |
| Has the corpus ever caught a real divergence? | **No.** `03` §6.3 question 5 remains open. |

The last row is the honest one. The mechanism is wired end to end on both platforms and
proven to load real data; it has not yet been shown to catch the thing it was built to
catch.
