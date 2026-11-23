---
"@frak-labs/components": patch
---

`sdk_init_failed` now sends `reason` as a short code: `config_missing`, `client_unavailable`, `rpc_<code>` when client setup throws a `FrakRpcError`, or the error name for any other error. It used to send the error message, which starts with `[Frak SDK]`, and OpenPanel drops any string that starts with `[` without ending with `]`, so `reason` was never stored.
