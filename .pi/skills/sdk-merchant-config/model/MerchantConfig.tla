--------------------------- MODULE MerchantConfig ---------------------------
(* One merchant page's config lifecycle, across reloads that share localStorage:  *)
(* sdk/core/src/config/sdkConfigStore.ts, config/loadCachedConfig.ts,              *)
(* clients/setupClient.ts, clients/createIFrameFrakClient.ts (postConnectionSetup, *)
(* sendLifecycleConfig, destroy, setupProofFreshnessRepush), and the listener's   *)
(* handleResolvedConfig. ../SKILL.md maps every action and lists what is left out. *)
EXTENDS Naturals, Sequences

CONSTANTS MaxReloads, MaxFetchOk, MaxRepush

Nothing  == [k |-> "none", v |-> 0]      \* no cache entry / no listener context
Empty    == [k |-> "empty", v |-> 0]     \* freshEmptyConfig(): isResolved false
Fallback == [k |-> "fallback", v |-> 0]  \* mergeAndSetConfig(undefined): isResolved, no allowedDomains
Backend(n) == [k |-> "backend", v |-> n] \* built from a /user/merchant/resolve response

VARIABLES
    lsCfg, lsFresh, \* localStorage "frak-config-cache:<domain>:<lang>" and whether it is under CACHE_TTL
    glob,           \* window.__frakSdkConfig
    page,           \* "off" | "connecting" | "fetchwait" | "merging" (setup done, fresh merge pending) | "done"
    fetch,          \* configPromise: "none" (not started) | "inflight" | "ok" | "fail"
    fetchOks,       \* successful /resolve responses so far; each one is a newer backend config
    sentCached,     \* postConnectionSetup sent the cached config (used by the fix mutants)
    chain,          \* sendChain: queued resolved-config posts, oldest first
    ctxSent,        \* contextSent resolved
    lctx,           \* listener's resolvingContextStore context (last write wins)
    destroyed,      \* destroy() ran
    detached,       \* rpcClient.cleanup() ran: posts and `connected` no longer cross
    repushes, reloads,
    \* ghosts: what the rules are about, never read by an action's guard
    downgraded, writeAfterDestroy, earlyRequest

vars == << lsCfg, lsFresh, glob, page, fetch, fetchOks, sentCached, chain, ctxSent, lctx,
           destroyed, detached, repushes, reloads, downgraded, writeAfterDestroy, earlyRequest >>

pageVars == << glob, page, fetch, sentCached, chain, ctxSent, lctx, destroyed, detached, repushes >>
ghosts == << downgraded, writeAfterDestroy, earlyRequest >>

Init ==
    /\ lsCfg \in {Nothing, Backend(0)}
    /\ lsFresh \in BOOLEAN
    /\ glob = Empty
    /\ page = "off"
    /\ fetch = "none"
    /\ fetchOks = 0
    /\ sentCached = FALSE
    /\ chain = << >>
    /\ ctxSent = FALSE
    /\ lctx = Nothing
    /\ destroyed = FALSE
    /\ detached = FALSE
    /\ repushes = 0
    /\ reloads = 0
    /\ downgraded = FALSE
    /\ writeAfterDestroy = FALSE
    /\ earlyRequest = FALSE

Send(cfg, resolves) == chain' = Append(chain, [cfg |-> cfg, resolves |-> resolves])

-----------------------------------------------------------------------------
(* setupClient → loadCachedConfig (setCacheScope + reset: publish the cache whatever *)
(* its age), then createIFrameFrakClient: fetch only when the cache is not fresh.    *)
Create ==
    /\ page = "off"
    /\ glob' = IF lsCfg = Nothing THEN Empty ELSE lsCfg
    /\ fetch' = IF lsCfg # Nothing /\ lsFresh THEN "none" ELSE "inflight"
    /\ page' = "connecting"
    /\ UNCHANGED << lsCfg, lsFresh, fetchOks, sentCached, chain, ctxSent, lctx, destroyed,
                    detached, repushes, reloads, ghosts >>

(* fetchFromBackend answers. *)
FetchOk ==
    /\ fetch = "inflight" /\ fetchOks < MaxFetchOk
    /\ fetch' = "ok"
    /\ fetchOks' = fetchOks + 1
    /\ UNCHANGED << lsCfg, lsFresh, glob, page, sentCached, chain, ctxSent, lctx, destroyed,
                    detached, repushes, reloads, ghosts >>

(* Network error or non-2xx: resolve() catches and yields undefined. *)
FetchFail ==
    /\ fetch = "inflight"
    /\ fetch' = "fail"
    /\ UNCHANGED << lsCfg, lsFresh, glob, page, fetchOks, sentCached, chain, ctxSent, lctx,
                    destroyed, detached, repushes, reloads, ghosts >>

(* postConnectionSetup after `await lifecycleManager.isConnected`: send the cached *)
(* config when the store is resolved. A running fetch is awaited only when nothing  *)
(* was sent; otherwise setup returns and the merge lands later.                   *)
Connect ==
    /\ page = "connecting" /\ ~detached
    /\ IF glob.k # "empty" THEN Send(glob, TRUE) ELSE UNCHANGED chain
    /\ sentCached' = (glob.k # "empty")
    /\ page' = CASE fetch = "none" -> "done"
                  [] glob.k # "empty" -> "merging"
                  [] OTHER -> "fetchwait"
    /\ UNCHANGED << lsCfg, lsFresh, glob, fetch, fetchOks, ctxSent, lctx, destroyed, detached,
                    repushes, reloads, ghosts >>

(* configPromise settles: mergeAndSetConfig → sdkConfigStore.setConfig (global + *)
(* writeCache, both unconditional on isResolved), then sendLifecycleConfig.        *)
Merge ==
    /\ page \in {"fetchwait", "merging"} /\ fetch \in {"ok", "fail"}
    /\ LET cfg == IF fetch = "ok" THEN Backend(fetchOks) ELSE Fallback
       IN /\ glob' = cfg
          /\ lsCfg' = cfg
          /\ lsFresh' = TRUE
          /\ Send(cfg, TRUE)
    /\ writeAfterDestroy' = (writeAfterDestroy \/ destroyed)
    /\ page' = "done"
    /\ UNCHANGED << fetch, fetchOks, sentCached, ctxSent, lctx, destroyed, detached, repushes,
                    reloads, downgraded, earlyRequest >>

(* sendChain step: buildSdkIdentity, rpcClient.sendLifecycle, then .then(contextSent.resolve) *)
(* for the setup sends. The listener applies it synchronously (handleResolvedConfig).        *)
PostAt(i) ==
    /\ LET m == chain[i]
       IN /\ IF detached
             THEN UNCHANGED << lctx, downgraded >>
             ELSE /\ lctx' = m.cfg
                  /\ downgraded' = (downgraded \/ (lctx.k = "backend" /\ m.cfg.k # "backend"))
          /\ ctxSent' = (ctxSent \/ m.resolves)
    /\ chain' = SubSeq(chain, 1, i - 1) \o SubSeq(chain, i + 1, Len(chain))
    /\ UNCHANGED << lsCfg, lsFresh, glob, page, fetch, fetchOks, sentCached, destroyed, detached,
                    repushes, reloads, writeAfterDestroy, earlyRequest >>

\* Oldest first: each send is chained onto the previous one.
Post == chain # << >> /\ PostAt(1)

(* An RPC request passes the client middleware: connected, then `await contextSent`. *)
Request ==
    /\ page # "off" /\ page # "connecting" /\ ~detached /\ ctxSent
    /\ earlyRequest' = (earlyRequest \/ lctx = Nothing)
    /\ UNCHANGED << lsCfg, lsFresh, glob, page, fetch, fetchOks, sentCached, chain, ctxSent,
                    lctx, destroyed, detached, repushes, reloads, downgraded, writeAfterDestroy >>

(* setupProofFreshnessRepush, installed once setup returns, stopped by destroy. *)
Repush ==
    /\ page \in {"merging", "done"} /\ ~destroyed /\ glob.k # "empty" /\ repushes < MaxRepush
    /\ Send(glob, FALSE)
    /\ repushes' = repushes + 1
    /\ UNCHANGED << lsCfg, lsFresh, glob, page, fetch, fetchOks, sentCached, ctxSent, lctx,
                    destroyed, detached, reloads, ghosts >>

(* client.destroy(): cleanup; the full form also clearCache() then reset(), which finds *)
(* no cache and publishes an empty config.                                              *)
Destroy(full) ==
    /\ page # "off" /\ ~destroyed
    /\ destroyed' = TRUE
    /\ detached' = TRUE
    /\ IF full
       THEN lsCfg' = Nothing /\ glob' = Empty
       ELSE UNCHANGED << lsCfg, glob >>
    /\ UNCHANGED << lsFresh, page, fetch, fetchOks, sentCached, chain, ctxSent, lctx, repushes,
                    reloads, ghosts >>

(* CACHE_TTL (30 s) passes. *)
CacheAges ==
    /\ lsCfg # Nothing /\ lsFresh
    /\ lsFresh' = FALSE
    /\ UNCHANGED << lsCfg, glob, page, fetch, fetchOks, sentCached, chain, ctxSent, lctx,
                    destroyed, detached, repushes, reloads, ghosts >>

(* The visitor navigates or reloads: page memory and the iframe are gone, localStorage stays. *)
Reload ==
    /\ page # "off" /\ reloads < MaxReloads
    /\ reloads' = reloads + 1
    /\ glob' = Empty
    /\ page' = "off"
    /\ fetch' = "none"
    /\ sentCached' = FALSE
    /\ chain' = << >>
    /\ ctxSent' = FALSE
    /\ lctx' = Nothing
    /\ destroyed' = FALSE
    /\ detached' = FALSE
    /\ repushes' = 0
    /\ UNCHANGED << lsCfg, lsFresh, fetchOks, ghosts >>

DestroyFull == Destroy(TRUE)
DestroyDetach == Destroy(FALSE)

Next ==
    \/ Create \/ FetchOk \/ FetchFail \/ Connect \/ Merge \/ Post \/ Request \/ Repush
    \/ DestroyFull \/ DestroyDetach \/ CacheAges \/ Reload

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
(* The rules. ../SKILL.md states each one and the harm in plain words. *)

NoTrustDowngrade == ~downgraded

CacheOnlyBackend == lsCfg.k \in {"none", "backend"}

Settled == page \in {"merging", "done"} /\ chain = << >> /\ ~detached

ListenerEndsOnLatest == (Settled /\ glob.k # "empty") => lctx = glob

ContextAlwaysArrives == Settled => ctxSent

NoRequestBeforeContext == ~earlyRequest

NoWriteAfterDestroy == ~writeAfterDestroy
=============================================================================
