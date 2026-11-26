---------------------------- MODULE EventOutbox ----------------------------
(* The Android tracking outbox: sdk/android/frak-sdk/.../tracking/EventOutbox.kt *)
(* over EventQueue.kt, driven by core/DefaultFrakClient.kt. Each action names    *)
(* the code it stands for; ../SKILL.md maps every one and lists what is left out. *)
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS Rows, MaxId, MaxFailures, ReconcileEvery, MaxToggles, MaxCrashes, NoId

None == "none"
Flushers == {"loop", "direct"}
Outcomes == {"Delivered", "Retryable", "Rejected", "Hold"}

VARIABLES
    disk,        \* EventQueue's JSONL file, oldest first
    nextRow,     \* next track() call to start
    capturing,   \* track() calls past requireTrackingEnabled, not yet appended
    id,          \* AnonymousIdStore's current id
    consent,     \* TrackingConsent.isEnabled()
    toggles, crashes, alive,
    purgeDue,    \* identity.reset() or consent.setEnabled(false) done, tracker.purge() not yet
    backoff,     \* Backoff.isBackingOff("track"), in memory
    dstate,      \* EventOutbox.drainState
    sched,       \* track() calls that appended and have not run scheduleFlush() yet
    mutex,       \* flushMutex holder
    pc, pending, idx, snapId, delivered, retried,
    \* ghosts: what the rules are about, never read by an action's guard
    epoch, fate, unflushed, deadIdSend, offSend, withdrawnSend

vars == << disk, nextRow, capturing, id, consent, toggles, crashes, alive, purgeDue,
           backoff, dstate, sched, mutex, pc, pending, idx, snapId, delivered, retried,
           epoch, fate, unflushed, deadIdSend, offSend, withdrawnSend >>

flushVars == << pending, idx, snapId, delivered, retried >>

Init ==
    /\ disk = << >>
    /\ nextRow = 1
    /\ capturing = {}
    /\ id = 1
    /\ consent = TRUE
    /\ toggles = 0
    /\ crashes = 0
    /\ alive = TRUE
    /\ purgeDue = FALSE
    /\ backoff = FALSE
    /\ dstate = "IDLE"
    /\ sched = {}
    /\ mutex = None
    /\ pc = [f \in Flushers |-> "none"]
    /\ pending = [f \in Flushers |-> << >>]
    /\ idx = [f \in Flushers |-> 1]
    /\ snapId = [f \in Flushers |-> NoId]
    /\ delivered = [f \in Flushers |-> {}]
    /\ retried = [f \in Flushers |-> {}]
    /\ epoch = 0
    /\ fate = [r \in Rows |-> "untracked"]
    /\ unflushed = {}
    /\ deadIdSend = FALSE
    /\ offSend = FALSE
    /\ withdrawnSend = FALSE

OnDisk(r) == \E i \in 1..Len(disk) : disk[i].r = r

\* EventQueue.reconcile: drop delivered row ids, swap in retried rows, from a fresh read.
Updated(row, ret) == IF \E x \in ret : x.r = row.r THEN CHOOSE x \in ret : x.r = row.r ELSE row
Reconciled(file, del, ret) ==
    LET kept == SelectSeq(file, LAMBDA x : x.r \notin del)
    IN [i \in 1..Len(kept) |-> Updated(kept[i], ret)]

\* Purge drops the file; a queued row on it is gone on purpose.
PurgedFate == [r \in Rows |-> IF fate[r] = "queued" /\ OnDisk(r) THEN "purged" ELSE fate[r]]

ClearFlush(f) ==
    /\ pending' = [pending EXCEPT ![f] = << >>]
    /\ idx' = [idx EXCEPT ![f] = 1]
    /\ snapId' = [snapId EXCEPT ![f] = NoId]
    /\ delivered' = [delivered EXCEPT ![f] = {}]
    /\ retried' = [retried EXCEPT ![f] = {}]

\* Which step follows row i: the checkpoint every ReconcileEvery rows, or the final reconcile.
NextPc(f, i) ==
    IF i > Len(pending[f]) THEN "recon"
    ELSE IF i > 1 /\ (i - 1) % ReconcileEvery = 0 THEN "ckpt"
    ELSE "row"

-----------------------------------------------------------------------------
(* DefaultFrakClient.track: requireTrackingEnabled(), then capture. *)
TrackBegin ==
    /\ alive /\ consent /\ nextRow \in Rows
    /\ capturing' = capturing \cup {[r |-> nextRow, ep |-> epoch]}
    /\ nextRow' = nextRow + 1
    /\ UNCHANGED << disk, id, consent, toggles, crashes, alive, purgeDue, backoff, dstate,
                    sched, mutex, pc, flushVars, epoch, fate, unflushed, deadIdSend, offSend,
                    withdrawnSend >>

(* identity.anonymousId() (null once consent is off), then EventOutbox.enqueue. *)
TrackAppend(c) ==
    /\ alive
    /\ disk' = Append(disk, [r |-> c.r, cid |-> IF consent THEN id ELSE NoId,
                             f |-> 0, held |-> FALSE, ep |-> c.ep])
    /\ capturing' = capturing \ {c}
    /\ sched' = sched \cup {c.r}
    /\ fate' = [fate EXCEPT ![c.r] = "queued"]
    /\ unflushed' = unflushed \cup {c.r}
    /\ UNCHANGED << nextRow, id, consent, toggles, crashes, alive, purgeDue, backoff, dstate,
                    mutex, pc, flushVars, epoch, deadIdSend, offSend, withdrawnSend >>

(* EventOutbox.scheduleFlush: each CAS is atomic, so the retry loop is one step. *)
Schedule(r) ==
    /\ alive /\ r \in sched
    /\ sched' = sched \ {r}
    /\ \/ /\ dstate = "IDLE"
          /\ dstate' = "DRAINING"
          /\ pc' = [pc EXCEPT !["loop"] = "top"]
       \/ /\ dstate = "DRAINING"
          /\ dstate' = "DRAIN_AGAIN"
          /\ UNCHANGED pc
       \/ /\ dstate = "DRAIN_AGAIN"
          /\ UNCHANGED << dstate, pc >>
    /\ UNCHANGED << disk, nextRow, capturing, id, consent, toggles, crashes, alive, purgeDue,
                    backoff, mutex, flushVars, epoch, fate, unflushed, deadIdSend, offSend,
                    withdrawnSend >>

(* The launched coroutine: `do { drainState.set(DRAINING); flush() }`. *)
LoopTop ==
    /\ pc["loop"] = "top"
    /\ dstate' = "DRAINING"
    /\ pc' = [pc EXCEPT !["loop"] = "lock"]
    /\ UNCHANGED << disk, nextRow, capturing, id, consent, toggles, crashes, alive, purgeDue,
                    backoff, sched, mutex, flushVars, epoch, fate, unflushed, deadIdSend,
                    offSend, withdrawnSend >>

(* `while (!drainState.compareAndSet(DRAINING, IDLE))`. *)
LoopCas ==
    /\ pc["loop"] = "cas"
    /\ IF dstate = "DRAINING"
       THEN dstate' = "IDLE" /\ pc' = [pc EXCEPT !["loop"] = "none"]
       ELSE UNCHANGED dstate /\ pc' = [pc EXCEPT !["loop"] = "top"]
    /\ UNCHANGED << disk, nextRow, capturing, id, consent, toggles, crashes, alive, purgeDue,
                    backoff, sched, mutex, flushVars, epoch, fate, unflushed, deadIdSend,
                    offSend, withdrawnSend >>

(* flush(): take flushMutex, check consent and backoff, read the file, read the id. *)
Start(f) ==
    /\ alive /\ pc[f] = "lock" /\ mutex = None
    /\ mutex' = f
    /\ unflushed' = {}
    /\ IF ~consent \/ backoff
       THEN pc' = [pc EXCEPT ![f] = "release"] /\ UNCHANGED flushVars
       ELSE /\ pending' = [pending EXCEPT ![f] = disk]
            /\ snapId' = [snapId EXCEPT ![f] = id]
            /\ idx' = [idx EXCEPT ![f] = 1]
            /\ delivered' = [delivered EXCEPT ![f] = {}]
            /\ retried' = [retried EXCEPT ![f] = {}]
            /\ pc' = [pc EXCEPT ![f] = IF disk = << >> THEN "recon" ELSE "row"]
    /\ UNCHANGED << disk, nextRow, capturing, id, consent, toggles, crashes, alive, purgeDue,
                    backoff, dstate, sched, epoch, fate, deadIdSend, offSend, withdrawnSend >>

(* One row of the drain loop. The per-row consent check and the request are one step:   *)
(* a withdrawal landing while one request is already on the wire is accepted by design. *)
Row(f) ==
    LET e == pending[f][idx[f]]
        stale == e.cid # NoId /\ snapId[f] # NoId /\ e.cid # snapId[f]
        row == IF e.cid = NoId /\ snapId[f] # NoId THEN [e EXCEPT !.cid = snapId[f]] ELSE e
        next == NextPc(f, idx[f] + 1)
        Continue == /\ idx' = [idx EXCEPT ![f] = idx[f] + 1]
                    /\ pc' = [pc EXCEPT ![f] = next]
        Break == pc' = [pc EXCEPT ![f] = "recon"] /\ UNCHANGED idx
        Drop == /\ delivered' = [delivered EXCEPT ![f] = @ \cup {e.r}]
                /\ fate' = [fate EXCEPT ![e.r] = IF @ = "queued" THEN "dropped" ELSE @]
        Request == /\ deadIdSend' = (deadIdSend \/ row.cid # id)
                   /\ offSend' = (offSend \/ ~consent)
                   /\ withdrawnSend' = (withdrawnSend \/ row.ep < epoch)
    IN
    /\ alive /\ pc[f] = "row" /\ mutex = f
    /\ IF ~consent
       THEN Break /\ UNCHANGED << delivered, retried, backoff, fate, deadIdSend, offSend, withdrawnSend >>
       ELSE IF stale
       THEN Continue /\ Drop /\ UNCHANGED << retried, backoff, deadIdSend, offSend, withdrawnSend >>
       ELSE IF row.cid = NoId
       THEN \* DeliveryOutcome.Hold without a request
            /\ IF row.held
               THEN \/ Break /\ UNCHANGED << delivered, retried, fate >>
                    \/ Continue /\ Drop /\ UNCHANGED retried
               ELSE /\ Break
                    /\ retried' = [retried EXCEPT ![f] = @ \cup {[row EXCEPT !.held = TRUE]}]
                    /\ UNCHANGED << delivered, fate >>
            /\ UNCHANGED << backoff, deadIdSend, offSend, withdrawnSend >>
       ELSE \E o \in Outcomes :
            CASE o = "Delivered" ->
                    /\ Continue /\ Request
                    /\ backoff' = FALSE
                    /\ delivered' = [delivered EXCEPT ![f] = @ \cup {e.r}]
                    /\ fate' = [fate EXCEPT ![e.r] = IF @ = "queued" THEN "sent" ELSE @]
                    /\ UNCHANGED retried
              [] o = "Retryable" ->
                    /\ Break /\ Request
                    /\ backoff' = TRUE
                    /\ UNCHANGED << delivered, retried, fate >>
              [] o = "Rejected" ->
                    /\ Continue /\ Request
                    /\ UNCHANGED backoff
                    /\ IF row.f + 1 >= MaxFailures
                       THEN Drop /\ UNCHANGED retried
                       ELSE /\ retried' = [retried EXCEPT ![f] = @ \cup {[row EXCEPT !.f = row.f + 1]}]
                            /\ UNCHANGED << delivered, fate >>
              [] o = "Hold" ->
                    /\ UNCHANGED << backoff, deadIdSend, offSend, withdrawnSend >>
                    /\ IF row.held
                       THEN \/ Break /\ UNCHANGED << delivered, retried, fate >>
                            \/ Continue /\ Drop /\ UNCHANGED retried
                       ELSE /\ Break
                            /\ retried' = [retried EXCEPT ![f] = @ \cup {[row EXCEPT !.held = TRUE]}]
                            /\ UNCHANGED << delivered, fate >>
    /\ UNCHANGED << disk, nextRow, capturing, id, consent, toggles, crashes, alive, purgeDue,
                    dstate, sched, mutex, pending, snapId, epoch, unflushed >>

(* queue.reconcile under queueMutex. `durable` false: the rewrite did not land, file unchanged. *)
Compact(f) ==
    \E durable \in BOOLEAN :
        disk' = IF durable THEN Reconciled(disk, delivered[f], retried[f]) ELSE disk

(* checkpoint() every RECONCILE_EVERY rows. *)
Checkpoint(f) ==
    /\ alive /\ pc[f] = "ckpt" /\ mutex = f
    /\ Compact(f)
    /\ delivered' = [delivered EXCEPT ![f] = {}]
    /\ retried' = [retried EXCEPT ![f] = {}]
    /\ pc' = [pc EXCEPT ![f] = "row"]
    /\ UNCHANGED << nextRow, capturing, id, consent, toggles, crashes, alive, purgeDue, backoff,
                    dstate, sched, mutex, pending, idx, snapId, epoch, fate, unflushed,
                    deadIdSend, offSend, withdrawnSend >>

(* The reconcile at the end of flush(). *)
Reconcile(f) ==
    /\ alive /\ pc[f] = "recon" /\ mutex = f
    /\ Compact(f)
    /\ pc' = [pc EXCEPT ![f] = "release"]
    /\ UNCHANGED << nextRow, capturing, id, consent, toggles, crashes, alive, purgeDue, backoff,
                    dstate, sched, mutex, flushVars, epoch, fate, unflushed, deadIdSend,
                    offSend, withdrawnSend >>

(* flush() returns and releases flushMutex. *)
Release(f) ==
    /\ alive /\ pc[f] = "release" /\ mutex = f
    /\ mutex' = None
    /\ pc' = [pc EXCEPT ![f] = IF f = "loop" THEN "cas" ELSE "none"]
    /\ ClearFlush(f)
    /\ UNCHANGED << disk, nextRow, capturing, id, consent, toggles, crashes, alive, purgeDue,
                    backoff, dstate, sched, epoch, fate, unflushed, deadIdSend, offSend,
                    withdrawnSend >>

(* DefaultFrakClient.resetAnonymousId: identity.reset() erased the key; purge() follows. *)
ResetId ==
    /\ alive /\ id < MaxId /\ ~purgeDue
    /\ id' = id + 1
    /\ purgeDue' = TRUE
    /\ UNCHANGED << disk, nextRow, capturing, consent, toggles, crashes, alive, backoff, dstate,
                    sched, mutex, pc, flushVars, epoch, fate, unflushed, deadIdSend, offSend,
                    withdrawnSend >>

(* setTrackingEnabled(false): consent.setEnabled(false), then purge(). *)
Withdraw ==
    /\ alive /\ consent /\ toggles < MaxToggles /\ ~purgeDue
    /\ consent' = FALSE
    /\ toggles' = toggles + 1
    /\ epoch' = epoch + 1
    /\ purgeDue' = TRUE
    /\ UNCHANGED << disk, nextRow, capturing, id, crashes, alive, backoff, dstate, sched, mutex,
                    pc, flushVars, fate, unflushed, deadIdSend, offSend, withdrawnSend >>

(* setTrackingEnabled(true): no purge, no flush. After the withdrawal's purge returned. *)
Enable ==
    /\ alive /\ ~consent /\ toggles < MaxToggles /\ ~purgeDue
    /\ consent' = TRUE
    /\ toggles' = toggles + 1
    /\ UNCHANGED << disk, nextRow, capturing, id, crashes, alive, purgeDue, backoff, dstate,
                    sched, mutex, pc, flushVars, epoch, fate, unflushed, deadIdSend, offSend,
                    withdrawnSend >>

(* EventOutbox.purge: queue.clear() under queueMutex. *)
Purge ==
    /\ alive /\ purgeDue
    /\ disk' = << >>
    /\ fate' = PurgedFate
    /\ purgeDue' = FALSE
    /\ UNCHANGED << nextRow, capturing, id, consent, toggles, crashes, alive, backoff, dstate,
                    sched, mutex, pc, flushVars, epoch, unflushed, deadIdSend, offSend,
                    withdrawnSend >>

BackoffEnds ==
    /\ backoff
    /\ backoff' = FALSE
    /\ UNCHANGED << disk, nextRow, capturing, id, consent, toggles, crashes, alive, purgeDue,
                    dstate, sched, mutex, pc, flushVars, epoch, fate, unflushed, deadIdSend,
                    offSend, withdrawnSend >>

(* The process dies: memory is gone, the file, the key and the consent decision stay. *)
Crash ==
    /\ alive /\ crashes < MaxCrashes
    /\ alive' = FALSE
    /\ crashes' = crashes + 1
    /\ capturing' = {}
    /\ sched' = {}
    /\ purgeDue' = FALSE
    /\ dstate' = "IDLE"
    /\ mutex' = None
    /\ pc' = [f \in Flushers |-> "none"]
    /\ pending' = [f \in Flushers |-> << >>]
    /\ idx' = [f \in Flushers |-> 1]
    /\ snapId' = [f \in Flushers |-> NoId]
    /\ delivered' = [f \in Flushers |-> {}]
    /\ retried' = [f \in Flushers |-> {}]
    /\ UNCHANGED << disk, nextRow, id, consent, toggles, backoff, epoch, fate, unflushed,
                    deadIdSend, offSend, withdrawnSend >>

(* DefaultFrakClient init: purge when consent is off, else a direct tracker.flush(). *)
Restart ==
    /\ ~alive
    /\ alive' = TRUE
    /\ backoff' = FALSE
    /\ IF consent
       THEN pc' = [pc EXCEPT !["direct"] = "lock"] /\ UNCHANGED << disk, fate >>
       ELSE disk' = << >> /\ fate' = PurgedFate /\ UNCHANGED pc
    /\ UNCHANGED << nextRow, capturing, id, consent, toggles, crashes, purgeDue, dstate, sched,
                    mutex, flushVars, epoch, unflushed, deadIdSend, offSend, withdrawnSend >>

\* Named, so TLC's traces say TrackEnqueue / ScheduleFlush rather than Next.
TrackEnqueue == \E c \in capturing : TrackAppend(c)
ScheduleFlush == \E r \in sched : Schedule(r)

Next ==
    \/ TrackBegin
    \/ TrackEnqueue
    \/ ScheduleFlush
    \/ LoopTop \/ LoopCas
    \/ \E f \in Flushers : Start(f) \/ Row(f) \/ Checkpoint(f) \/ Reconcile(f) \/ Release(f)
    \/ ResetId \/ Withdraw \/ Enable \/ Purge \/ BackoffEnds
    \/ Crash \/ Restart

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
(* The rules. ../SKILL.md states each one and the harm in plain words. *)

NoSilentLoss == \A r \in Rows : fate[r] = "queued" => OnDisk(r)

Quiescent ==
    /\ alive /\ sched = {} /\ capturing = {} /\ ~purgeDue
    /\ \A f \in Flushers : pc[f] = "none"

NoLostWakeup == Quiescent => \A i \in 1..Len(disk) : disk[i].r \notin unflushed

NoSendWhileOff == ~offSend

NoSendUnderResetId == ~deadIdSend

NoSendOfWithdrawnEvent == ~withdrawnSend
=============================================================================
