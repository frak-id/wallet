# Frak Game draw

Status: built on `feat/fra-368-join-and-referee-tickets`; the two Instagram levels and the candidate window (`frak-draw-v2`) on `feat/fra-369-instagram-two-levels`. The `game_draws` table (now with `notified_rank`, `candidate_notified_at`, `reminded_rank`), the `interaction_logs_game_join_idx` partial index (`interaction_logs`, on `payload->>'gameId'` and `identity_group_id` where `type = 'game_join'`) and the Instagram tables still need their migration (DB team). Tracks FRA-368, FRA-369 and the draw questions on FRA-363.
Inputs: research briefs run on 2026-10-26 on randomness sources and on how the draw fits the backend.

## Decisions

- One ticket is drawn at random among the eligible tickets at game end.
- Two Instagram levels (FRA-369). **Certified**: the player sent their code to @frak_fr by DM, so we know the account and re-read its follow from Meta. **Declared**: the player typed a handle, nothing proven.
- Eligible **at freeze time** = certified and following, or declared. A certified non-follower's tickets are discarded (`not_following`), and so are those of a player with neither level (`not_linked`): 14 tickets and no Instagram = 0 in the draw.
- To be paid, a candidate must be certified **and** following. One who is not (declared, or certified then unfollowed) gets 24 h from the push telling them they were drawn; then the turn passes to the next candidate.
- No ticket cap per player.
- Every draw keeps a durable record, so anyone can check it later.

## In one paragraph

Freeze the eligible ticket list after the game ends, publish its hash and a **future drand round** at the same moment, then derive the winner from that round's public randomness. drand (League of Entropy, `quicknet`) is free, anyone can verify it with the chain's public key, and nobody, us included, knows a round before it is emitted. The one seed yields a **ranked list** of distinct players: candidate 1 wins unless the admin rejects them for a reason the rules allow, then candidate 2, and so on. No re-roll is possible. Everything lives in one `game_draws` row per game and is served on a public endpoint.

Rejected: Chainlink VRF (needs a consumer contract and a funded subscription, and the operator can re-request unless the contract forbids it; only worth it if the result must live on-chain), block hashes (Arbitrum's docs say `blockhash` is not a secure randomness source; the sequencer controls timing), a server seed or CSPRNG (the operator can grind or silently re-roll).

## Flow

1. **Freeze.** The `gameDraws` cron (every 5 min, one replica at a time through an advisory lock) freezes every game that ended between 7 days and 1 hour ago and has no draw. The hour lets cancellations right after the end land. An older game is only frozen by hand (`game draw freeze <CODE>`), so a deploy never draws a long-finished test game.
   - Each participant's tickets are counted with `GamePlayerOrchestrator.ticketsOf`, the same code the wallet shows, so the draw can never disagree with the game page.
   - First, every certified follow read more than an hour ago is re-read from Meta. If Meta cannot answer (expired token, outage, throttling), the freeze throws and the next pass retries: it never reads an unknown as "not following".
   - Certified followers and declared players keep their tickets (`instagram: certified | declared` on the entry); the others are stored with `discarded: not_following | not_linked` and 0 draw tickets.
   - Each player gets a pid, `HMAC-SHA256(pid_key, identity_group_id)` cut to 32 hex characters. `pid_key` is random per draw and never published.
   - Canonical list: players holding draw tickets, sorted by pid, one `pid,tickets\n` line each. `snapshot_root = SHA-256(list)`, `total_tickets` = its sum.
   - The committed round is the first one emitted at least 10 minutes after the freeze. Root, total and round are public from that moment.
   - Nobody eligible: the draw is `void` at once.
2. **Draw.** Once the round is out, the cron fetches it from the drand relays in turn (api, api2, api3.drand.sh, then Cloudflare), keeps the first signature that verifies against quicknet's public key, and takes `randomness = SHA-256(signature)`.
   - For candidate j, sample `x = SHA-256(randomness ‖ game_id ‖ u64be(k))` with k counting every sample, reject `x ≥ floor(2^256 / T) × T` (no modulo bias), pick the player owning ticket `x mod T` in canonical order, then remove that player and their tickets from the pool. Up to 30 candidates under `frak-draw-v2`, 10 under `frak-draw-v1` (`drawCandidatesFor`): declared players who never certify each pass the turn on. The ranking keeps its prefix as the count grows, so v2's first 10 are v1's.
   - Status `drawn`.
3. **Candidate window** (`frak-draw-v2` draws only: a v1 draw froze followers only, so its candidates stay with the admin). On every pass the cron looks at the current candidate, reading the clock again after the freezes and draws, which can take minutes. Certified and following (re-read from Meta at most every 15 min): they wait for the admin. Otherwise:
   - Not told yet: `game_candidate_drawn` push ("Tu as été tiré au sort… Certifie ton Instagram avant le …"), `notified_rank` and `candidate_notified_at` set, `game_candidate_window_started` tracked. Their 24 h start there, so a certified candidate who unfollows while waiting for the admin still gets a full window.
   - In the last 4 hours: one `game_candidate_reminder` push (`reminded_rank`).
   - Past the 24 h: one last fresh read from Meta, then a rejection `not_verified_in_time` by `system`, and the next candidate is told in the same pass. A Meta failure skips the draw for that pass instead.
   - Each push is marked before it is sent, under the same advisory lock: a crash can lose one, never send it twice. The mark only applies while that rank is still under review, so a candidate an admin rejected meanwhile is not told.
   - There is no deadline before the first push: `verifyBy` stays null (in the review and in the wallet) until the window has really started.
   - A Meta outage is logged as a warning and retried on the next pass; it never rejects anyone.
4. **Review** (`bun scripts/frakGame.ts game draw show <CODE>`): the candidate under review with their tickets by source, their Instagram level, handle and follow state re-read now, whether they wait for the admin or for themselves (with their deadline), wallet and account age.
   - `game draw reject <CODE> --reason <reason>` with `not_verified_in_time`, `not_following_at_review`, `fraud`, `unreachable` or `ineligible` (under 18…). The next candidate is up; rejecting the last one makes the draw `void`.
   - `game draw confirm <CODE>` pays the candidate, only once they are certified and following (re-read from Meta; 409 `CANDIDATE_NOT_VERIFIED` otherwise, 502 if Meta cannot say). Both take `--actor`, kept on the draw.
   - Each review only applies if nobody reviewed the draw since it was read, so two admins cannot pay two people.
5. **Payout.** In the same transaction as the confirmation, an `asset_logs` row with recipient type `winner`, the game's prize amount in EURe, on the Frak merchant (paid from the shared campaign bank like any game reward), payable at once. The winner is resolved through identity merges at that moment, since the frozen list keeps the groups as they were. If the bank is short, the row waits in `bank_depleted` until it is funded.
   - Right after, the winner's wallet gets a `game_won` push ("Tu as gagné le Jeu Frak ! Tes 50 € arrivent dans ton porte-monnaie."), on top of the usual push when the payout settles.
6. **Announce** on Instagram, and keep the public record online.

## Storage: one table

`game_draws` (in `domain/game/db/schema.ts`), unique on `game_id`, so a freeze is an `insert … on conflict do nothing` and can never run twice:

- Commitment: `algorithm` (`frak-draw-v2`; v1 rows still replay), `frozen_at`, `pid_key`, `snapshot_root`, `total_tickets`, `drand_chain_hash`, `drand_round`.
- `entries jsonb`: every participant, `{ pid, identityGroupId, tickets, drawTickets, discarded, instagram }`, written once (`instagram` is absent on v1 rows).
- Randomness: `drand_signature`, `candidates jsonb` (ranked pids).
- Candidate window: `notified_rank`, `candidate_notified_at`, `reminded_rank` (-1 for none).
- Review: `rejections jsonb` (`{ pid, reason, actor, at }`, appended only), `winner_identity_group_id`, `confirmed_by`, `confirmed_at`, `asset_log_id`.
- `status`: `frozen | drawn | confirmed | void`.

Why not more tables: a per-entry table would only add an index nobody queries (one draw at a time, and the endpoint returns the whole list), and an append-only events table guards against editing our own rows, which the published root and the public drand round already expose. The external trail is the `game_draw_*` OpenPanel events and the backend logs. About 150 bytes per player: 10 000 players is about 1.5 MB of jsonb.

Why not zero: columns on `games` would work, but `games` is config and every game read (`select()` in `GameRepository`) would load the frozen list.

## Verification

- `GET /common/game/:gameId/draw`, no auth: algorithm, status, freeze time, root, total, the canonical list by pid, the drand round, its time, signature and randomness, the candidates, the rejections (reason and time, not the admin), the winner's pid and the payout transaction hash.
- The player's own pid comes with their game history (`pid` on each result), so they can find themselves in the list. It is null before the freeze and when their tickets did not count, since the list only holds players with draw tickets.
- `bun scripts/verifyGameDraw.ts <gameId> [--api <url>]` replays everything from the public record: the root, the total, that the round came after the freeze, the drand signature, the randomness, the ranking, the rejections and the winner. It shares `domain/game/draw.ts` with the backend and trusts nothing else.

## In the wallet

`GET /user/wallet/game/history` lists the player's ended games, latest first: prize, end date, their tickets (from the frozen list once there is one, counted live before), the draw's total tickets and participants, whether their tickets were discarded, and the outcome (`drawing` until the winner is confirmed, then `won` or `lost`, or `no_winner` for a void draw). The current candidate who still has to certify sees `pending_verification` with `verifyBy` once their push went out; nobody else learns who is being checked. With merged groups that both played, the entry holding the turn is the one shown. A game past the auto-freeze window with no draw is left out.

- **Home card**: with no open game, the last game played shows for 14 days after its end, with its outcome.
- **Game page**: with no open game, the last result in full on top: an icon and title for the outcome, the stats, and the player's tickets by source. A past player who has not joined the open game sees the home card for it instead. Past games are listed below as rows (date, tickets counted against the total, outcome), and a row opens that game's full result in a bottom sheet. Tickets thrown out for not following count as 0. Dates show the year only when it is not the current one.
- **Checking the draw**: a frozen game's result ends with a ghost "Vérifier le tirage" link that opens the public record, and the player's pid in a caption under it. Kept low-key on purpose: it is for the curious, and must not compete with the outcome.
- **Drawn, to certify**: a `pending_verification` result tops the game page and the home card, with the deadline and a button to `/game/instagram`.
- **Win screen**: a confirmed win less than 30 days old gets a full-screen confetti screen on the next wallet open, once per device (`frak_game_win_store` in local storage).

## Analytics

Server-side `productEvents`: `game_draw_frozen`, `game_draw_run`, `game_candidate_window_started {rank}`, `game_winner_rejected {rank, reason}`, `game_winner_confirmed {rank, prize_amount}` (the last on the winner's profile). Wallet side: `game_result_viewed {outcome}`, `game_win_screen_viewed` and `game_win_screen_closed {action}`.

## Retention

Draw records are kept 5 years. The public record is pseudonymous, and the winner is announced by Instagram handle only.

## Not done

- The migrations (DB team): `game_draws` with its candidate-window columns, `interaction_logs_game_join_idx`, and `instagram_declarations`, `instagram_link_codes`, `instagram_access_tokens`.
- A readable page for the public record: the wallet link opens the raw JSON.
- Anchoring the root on Arbitrum at freeze time, planned for later. Until then, only our own endpoint, logs and OpenPanel event show that the root came before the round.
