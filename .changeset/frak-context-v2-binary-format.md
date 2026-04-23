---
"@frak-labs/core-sdk": patch
---

Replace the V2 `FrakContext` wire format (JSON + base64url) with a compact binary layout: a 1-byte header (4 version bits + `has_c`/`has_w` flags + reserved bits) followed by raw UUID/address bytes and a big-endian uint32 timestamp. The resulting `fCtx` URL parameter is ~65% shorter across all variants (e.g. anonymous `c`-only drops from ~154 to 50 chars; hybrid `c`+`w` drops from ~220 to 76 chars). V1 payloads (20-byte wallet address) are unchanged and still recognized via length-based disambiguation.

`encodeFrakContextV2` now strictly validates that `m` and `c` are canonical UUIDs and that `t` fits in a uint32; invalid contexts return `undefined` from `FrakContextManager.compress`. Reserved header bits are checked on decode to keep future versions forward-compatible.
