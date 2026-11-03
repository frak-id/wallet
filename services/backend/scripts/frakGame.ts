import { parseArgs } from "node:util";
import { drandRoundTime } from "../src/domain/game/draw";
import {
    type DrawRejectionReason,
    DrawRejectionReasonSchema,
} from "../src/domain/game/schemas";
import { OrchestrationContext } from "../src/orchestration/context";
import { parseFrakMerchantOwner } from "../src/orchestration/internal";
import { HttpError } from "../src/utils/httpError";

const USAGE = `Usage: bun scripts/frakGame.ts <command> [options]
  merchant --owner <0xWallet|accountId> --domain <domain>
      seed the Frak merchant on the shared campaign bank (idempotent)
  signup-rule --referrer <amount> --referee <amount> --budget <amount> [--unlock-days 30]
      publish the referral signup rule (pause it from the business dashboard)
  game create --code <CODE> --reward <amount> --budget <amount> --starts <iso> --ends <iso> --prize-amount <eur>
              [--prize <text>] [--sponsor <merchantId>] [--unlock-days 30]
      open a game on a Frak code issued with scripts/frakReferralCode.ts
  game list | game pause <CODE> | game resume <CODE>
  game draw show <CODE>       the frozen list, the beacon and the candidate under review
  game draw freeze <CODE>     freeze an ended game now (the cron does it up to 7 days after the end)
  game draw run               freeze, draw and move candidate windows on, like the cron
  game draw reject <CODE> --reason not_verified_in_time|not_following_at_review|fraud|unreachable|ineligible
  game draw confirm <CODE>    pay the candidate under review (only once certified and following)
      --actor <name> on reject/confirm, defaults to $USER; it is kept on the draw
Amounts are in EURe, except --prize-amount (EUR). --unlock-days: how long a reward waits for its mission.
Every reward is held until a first brand reward or a certified follow: the referrer's
signup reward waits for the referee's, every other reward for its own recipient's.
A candidate who is not certified and following has 24 h from their push; the cron
then passes the turn on (not_verified_in_time).
Everything here is also on the business dashboard, under Internal > Frak Game.`;

const { values: opts, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
        owner: { type: "string" },
        domain: { type: "string" },
        referrer: { type: "string" },
        referee: { type: "string" },
        reward: { type: "string" },
        budget: { type: "string" },
        starts: { type: "string" },
        ends: { type: "string" },
        "prize-amount": { type: "string" },
        prize: { type: "string" },
        code: { type: "string" },
        sponsor: { type: "string" },
        "unlock-days": { type: "string", default: "30" },
        reason: { type: "string" },
        actor: { type: "string" },
    },
});

const admin = OrchestrationContext.orchestrators.frakGameAdmin;
const gameDraw = OrchestrationContext.orchestrators.gameDraw;

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

function required(name: keyof typeof opts): string {
    const value = opts[name];
    if (typeof value !== "string" || value.length === 0) {
        fail(`Missing --${name}\n\n${USAGE}`);
    }
    return value;
}

function positive(name: keyof typeof opts): number {
    const value = Number(required(name));
    if (!Number.isFinite(value) || value <= 0) fail(`Invalid --${name}`);
    return value;
}

function date(name: keyof typeof opts): Date {
    const value = new Date(required(name));
    if (Number.isNaN(value.getTime())) fail(`Invalid --${name} date`);
    return value;
}

async function seedMerchant() {
    const { merchant, created } = await admin.seedMerchant({
        domain: required("domain"),
        owner: parseFrakMerchantOwner(required("owner")),
    });
    console.log(
        created
            ? `Seeded Frak merchant ${merchant.id} on ${merchant.domain}`
            : `Frak merchant already seeded (${merchant.domain})`
    );
}

async function createSignupRule() {
    const rule = await admin.publishSignupRule({
        referrer: positive("referrer"),
        referee: positive("referee"),
        budget: positive("budget"),
        unlockDays: positive("unlock-days"),
    });
    console.log(`Published signup rule ${rule.id}`);
}

async function createGame() {
    const game = await admin.createGame({
        code: required("code"),
        reward: positive("reward"),
        budget: positive("budget"),
        startsAt: date("starts"),
        endsAt: date("ends"),
        prizeAmount: positive("prize-amount"),
        prizeDescription: opts.prize,
        sponsorMerchantId: opts.sponsor,
        unlockDays: positive("unlock-days"),
    });
    console.log(`Opened game ${game.id} (rule ${game.campaignRuleId})`);
}

async function listGames() {
    console.table(
        (await admin.listGames()).map((game) => ({
            code: game.code,
            status: game.status,
            draw: game.draw?.status ?? "-",
            startsAt: game.startsAt.toISOString(),
            endsAt: game.endsAt.toISOString(),
            participants: game.participants,
            ruleStatus: game.rule?.status ?? "?",
            budgetUsed: `${game.rule?.budget.used ?? 0}/${game.rule?.budget.total ?? "∞"}`,
            prizeAmount: game.prizeAmount,
            prize: game.prizeDescription,
        }))
    );
}

async function setGameStatus(
    raw: string | undefined,
    status: "active" | "paused"
) {
    if (!raw) fail(USAGE);
    const game = await admin.findGameByCode(raw);
    await admin.setStatus(game.id, status);
    console.log(`Game ${raw.toUpperCase()} is now ${status}`);
}

async function gameOf(raw: string | undefined) {
    if (!raw) fail(USAGE);
    return admin.findGameByCode(raw);
}

const REJECTION_REASONS = DrawRejectionReasonSchema.anyOf.map(
    (literal) => literal.const
);

function rejectionReason(): DrawRejectionReason {
    const reason = required("reason");
    const match = REJECTION_REASONS.find((known) => known === reason);
    if (!match) fail(`--reason must be one of ${REJECTION_REASONS.join(", ")}`);
    return match;
}

function actor(): string {
    return opts.actor ?? process.env.USER ?? "cli";
}

async function showDraw(raw: string | undefined) {
    const game = await gameOf(raw);
    const draw = await admin.drawOf(game.id);
    if (!draw) fail("Not frozen yet");
    console.table({
        status: draw.status,
        frozenAt: draw.frozenAt.toISOString(),
        snapshotRoot: draw.snapshotRoot,
        totalTickets: draw.totalTickets,
        participants: draw.participants,
        discarded: draw.participants - draw.eligibleParticipants,
        drandRound: draw.drand.round,
        roundTime: draw.drand.roundTime.toISOString(),
        beacon: draw.drand.signed ? "recorded" : "waiting",
        candidates: draw.candidates,
        rejections: draw.rejections.length,
    });
    for (const rejection of draw.rejections) {
        console.log(
            `rejected ${rejection.pid}: ${rejection.reason} by ${rejection.actor} at ${rejection.at}`
        );
    }
    const { candidate } = draw;
    if (!candidate) return;
    console.log(`\nCandidate #${candidate.rank + 1} (${candidate.pid})`);
    const { instagram } = candidate;
    console.table({
        identityGroupId: candidate.identityGroupId,
        wallet: candidate.wallet ?? "none",
        accountCreatedAt: candidate.accountCreatedAt?.toISOString() ?? "?",
        instagram: instagram.username ?? "none",
        instagramLevel: instagram.level,
        followsNow: instagram.follows ?? "unknown",
        followCheckedAt: instagram.checkedAt?.toISOString() ?? "-",
        followFresh: instagram.followFresh,
        awaiting: candidate.awaiting,
        verifyBy: candidate.verifyBy?.toISOString() ?? "-",
        drawTickets: candidate.drawTickets,
        ...candidate.tickets,
    });
}

async function freezeDraw(raw: string | undefined) {
    const game = await gameOf(raw);
    const draw = await admin.freeze(game.id);
    console.log(
        `Draw ${draw.status}: root ${draw.snapshotRoot}, ${draw.totalTickets} tickets, drand round ${draw.drandRound} at ${drandRoundTime(draw.drandRound).toISOString()}`
    );
}

async function runDraws() {
    const result = await gameDraw.runDue();
    console.log(
        `Frozen ${result.frozen}, drawn ${result.drawn}, candidate windows moved ${result.advanced}`
    );
}

async function rejectCandidate(raw: string | undefined) {
    const game = await gameOf(raw);
    const draw = await gameDraw.reject(game.id, rejectionReason(), actor());
    console.log(
        draw.status === "void"
            ? "Last candidate rejected: the draw has no winner"
            : `Rejected; candidate #${draw.rejections.length + 1} is now under review`
    );
}

async function confirmWinner(raw: string | undefined) {
    const game = await gameOf(raw);
    const draw = await gameDraw.confirm(game.id, actor());
    console.log(
        `Confirmed ${draw.winnerIdentityGroupId}: prize queued as asset log ${draw.assetLogId}`
    );
}

async function drawCommand(arg: string | undefined, drawArg?: string) {
    if (arg === "show") await showDraw(drawArg);
    else if (arg === "freeze") await freezeDraw(drawArg);
    else if (arg === "run") await runDraws();
    else if (arg === "reject") await rejectCandidate(drawArg);
    else if (arg === "confirm") await confirmWinner(drawArg);
    else fail(USAGE);
}

const [command, action, arg, drawArg] = positionals;
try {
    if (command === "merchant") await seedMerchant();
    else if (command === "signup-rule") await createSignupRule();
    else if (command === "game" && action === "create") await createGame();
    else if (command === "game" && action === "list") await listGames();
    else if (command === "game" && action === "pause")
        await setGameStatus(arg, "paused");
    else if (command === "game" && action === "resume")
        await setGameStatus(arg, "active");
    else if (command === "game" && action === "draw")
        await drawCommand(arg, drawArg);
    else fail(USAGE);
} catch (error) {
    if (error instanceof HttpError) fail(error.message);
    throw error;
}
process.exit(0);
