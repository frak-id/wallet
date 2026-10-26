# Frak Game draw: design proposal

Status: proposal, not built. Tracks FRA-368 (draw and winner review) and the open draw questions on FRA-363.
Inputs: research briefs run on 2026-10-26 on randomness sources and on how the draw fits the backend.

## Decisions already taken

- One ticket is drawn at random among the eligible tickets at game end.
- Eligible = the player's linked Instagram follows @frak_fr **at draw time**. A non-follower's tickets are discarded for that draw (14 tickets and no follow = 0 in the draw).
- No ticket cap per player.
- Every draw keeps a durable record of its decision and its logs, so anyone can check it later.

## Recommendation in one paragraph

Freeze the eligible ticket list at game end, publish its hash and a **future drand round** in the same step, then derive the winner from that round's public randomness. drand (League of Entropy, `quicknet`) is free, verifiable by anyone with the chain's public key, and nobody (us included) knows the round's value before it is emitted. From the one seed we derive a **ranked list** of distinct players: candidate 1 is the winner unless the admin rejects them for a written reason, in which case candidate 2 wins, and so on. No re-roll is ever possible. Everything is stored in one `game_draws` row per game and exposed on a public verification endpoint.

Rejected: Chainlink VRF (needs a consumer contract, a funded subscription, and the operator can re-request unless the contract forbids it; worth it only if the result must live on-chain), block hashes (Arbitrum's own docs say `blockhash` is not a secure randomness source; the sequencer controls timing), a server seed or CSPRNG (the operator can grind or silently re-roll).

## Flow

1. **Game creation** (`frakGame.ts game create`): nothing new; the rules version is recorded on the game.
2. **Freeze** (cron, `endsAt` + grace, e.g. 1 h so late refunds land): one row per game, never redone.
   - Count every participant's tickets with the same rules as `GamePlayerOrchestrator.ticketsOf`, in batch (about five grouped queries for the whole game, not one per player).
   - Read each player's Instagram link. Followers go in the eligible list; non-followers are stored with `discarded: not_following` and 0 draw tickets.
   - Canonical list: eligible players sorted by pseudonymous id `HMAC(per-game key, identity_group_id)`, serialized as `pid,tickets` lines; `root = SHA-256(list)`, `T = total tickets`.
   - Commit the target drand round `R` = first round starting at least 10 min after the freeze. Store `root`, `T`, player counts and `R` in the draw row.
   - Publish `root`, `T` and `R` right away (public endpoint, and optionally the story), so the freeze is visibly earlier than the randomness. Optional later: anchor `root` on Arbitrum for an external timestamp.
3. **Draw** (same cron, once round `R` exists): fetch round `R` from at least two drand relays, verify its BLS signature against the quicknet public key, `seed = SHA-256(signature)`.
   - For k = 1, 2, …: `x = SHA-256(seed ‖ game_id ‖ k)`, keep it only if `x < floor(2^256 / T) × T` (rejection sampling, no modulo bias), ticket index `x mod T`, map to the player owning that index (cumulative ranges, binary search). Skip players already picked. Stop at N distinct players (e.g. 10).
   - Store the round, signature, seed and ranked list. Status `pending_review`.
4. **Review** (`frakGame.ts game draw confirm|reject <game>`): the admin sees candidate 1 with the evidence (tickets by source, follow re-check, account age).
   - Reject only for a reason written in the rules: `not_following_at_review`, `fraud`, `unreachable` (no answer after X days), `ineligible` (under 18…). The reason is logged and public. Rejecting moves to the next candidate, never to new randomness.
   - Confirm creates the payout and closes the draw.
5. **Payout**: an `asset_logs` row on the Frak merchant, EURe, from the shared campaign bank, recipient type `winner` (new). Settlement pays it like any game reward. The prize budget must be in the bank, or the row waits in `bank_depleted`.
6. **Announce** on Instagram, and keep the public draw record online.

## Data model: one table (schema change, migration by the DB team)

`game_draws` in `domain/game/db/schema.ts`, one row per game, unique on `game_id` so the freeze is an `insert … on conflict do nothing` and can never run twice:

- Commitment: `rules_version`, `frozen_at`, `snapshot_root`, `total_tickets`, `drand_chain_hash`, `drand_round`.
- `entries jsonb`: the frozen list, `[{ pid, identityGroupId, bySource, drawTickets, discarded? }]` in canonical order. It is written once and is exactly what `snapshot_root` hashes.
- Randomness: `drand_signature`, `seed`, `ranked jsonb` (the ordered identity group ids).
- Review: `rejections jsonb` (`[{ identityGroupId, reason, actor, at }]`, append only in code), `winner_identity_group_id`, `confirmed_by`, `confirmed_at`, `asset_log_id`.
- `status`: `frozen | drawn | confirmed`.

Why not more: a per-entry table would only add an index nobody queries (one draw at a time, the endpoint returns the whole list), and an append-only events table guards against editing our own rows, which the published `root` and the public drand round already catch. The external trail is the `game_draw_*` OpenPanel events and the backend logs. Size: about 150 bytes per player, so 10 000 players is about 1.5 MB of TOASTed jsonb, read only by the draw code and the endpoint.

Why not zero: columns on `games` work, but `games` is config and every game read (`select()` in `GameRepository`) would load the frozen list.

Identity merges: `identity_group_id` is the only key shared by every ticket source. The frozen list is never recounted; a merge after the freeze is resolved through `identity_groups.merged_groups` at payout.

## Public verification

`GET /common/game/:id/draw`, no auth: `root`, `T`, `R`, chain hash, signature, seed, the canonical list with pseudonymous ids, ranked list, rejections with reasons, payout tx hash. Plus a short script in the repo that recomputes `root`, verifies the drand signature and replays the ranking. A player can check their own `pid` from the wallet.

## Analytics

Server-side `productEvents` (already wired): `game_draw_frozen`, `game_draw_run`, `game_winner_rejected {reason}`, `game_winner_confirmed`.

## Retention

Draw records are kept 5 years. The public record is pseudonymous, and the winner is announced by Instagram handle only.

## Open questions

- Number of ranked candidates N and the "unreachable" delay.
- Grace after `endsAt` before the freeze (refunds).
- Anchor `root` on Arbitrum, or publishing on the endpoint and in the story is enough?
- Should a player see their `pid` and the public record in the wallet, or only on request?
