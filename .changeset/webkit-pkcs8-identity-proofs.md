---
"@frak-labs/core-sdk": patch
---

Sign identity proofs on Safari, where a PKCS#8 key carrying no public point cannot be imported.

`signProof` picked its signer from `@noble/curves`' `isSupported()`, which probes keygen and JWK export and never touches the secret-key import every signature actually goes through. WebKit passes that probe, so WebCrypto was selected, and then every real call failed: noble's `raw` secret-key format wraps the 32-byte scalar in a PKCS#8 that omits the optional `[1] publicKey`, and `CryptoKeyEC::platformImportPkcs8` hands the result to an X9.63 importer wanting `04||X||Y||D`. WebKit cannot derive the point from the scalar, so it reads it out of the blob — walking onto the `[1]` tag without testing that it is there. The import threw, `signProof`'s catch returned `null`, and nothing surfaced. Gecko rejects the same encoding.

Because `buildSdkIdentity` drops all three proofs together when each one is null, `resolved-config` reached the listener with no `sdkIdentity` at all on every WebKit browser, including all of iOS. Without a `frak-install-v1` proof the sharing confirmation could not build an `/install` link and rendered its "Get my N euros" CTA disabled, which is how this was found. The `merge` and `mergeSource` proofs were lost on the same path, so SSO and in-app-redirect identity merges were silently skipped there too.

Keys are now encoded as a complete PKCS#8 carrying the public point, which WebKit accepts, so Safari keeps the native signing path rather than falling back to software. Two guards sit under it: the probe signs once with the encoding production uses instead of trusting `isSupported()`, and a signature that fails after the probe passed demotes to the pure-JS signer for the rest of the page instead of dropping the proof.
