import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { currentStablecoins } from "@frak-labs/app-essentials/blockchain";
import { isAddress } from "viem";
import { CampaignContext } from "../src/domain/campaign/context";
import type {
    CampaignRuleDefinition,
    CampaignTrigger,
    RewardDefinition,
} from "../src/domain/campaign/schemas";
import { GameContext } from "../src/domain/game/context";
import { drandRoundTime } from "../src/domain/game/draw";
import {
    type DrawRejectionReason,
    DrawRejectionReasonSchema,
    type GameStatus,
} from "../src/domain/game/schemas";
import { FRAK_MERCHANT_ID } from "../src/domain/merchant/constants";
import { MerchantContext } from "../src/domain/merchant/context";
import { FRAK_SHARED_CAMPAIGN_BANK } from "../src/domain/merchant/services/MerchantRegistrationService";
import { ReferralCodeContext } from "../src/domain/referral-code";
import { OrchestrationContext } from "../src/orchestration/context";

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
  game draw run               freeze and draw whatever is due, like the cron
  game draw reject <CODE> --reason not_following_at_review|fraud|unreachable|ineligible
  game draw confirm <CODE>    pay the candidate under review the prize
      --actor <name> on reject/confirm, defaults to $USER; it is kept on the draw
Amounts are in EURe, except --prize-amount (EUR). --unlock-days: how long a reward waits for its mission.
Every reward is held until a first brand reward: the referrer's signup reward
waits for the referee's, every other reward for its own recipient's.`;

// The game rule outlives the game so joins processed after the close still pay.
const GAME_RULE_GRACE_MS = 24 * 60 * 60 * 1000;

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

async function requireFrakMerchant() {
    const merchant =
        await MerchantContext.repositories.merchant.findById(FRAK_MERCHANT_ID);
    if (!merchant) fail("Frak merchant missing: run `merchant` first");
}

async function publishRule(params: {
    name: string;
    trigger: CampaignTrigger;
    rewards: [RewardDefinition["recipient"], number][];
    conditions?: CampaignRuleDefinition["conditions"];
    maxRewardsPerUser?: number;
    expiresAt?: Date;
}) {
    const management = CampaignContext.services.management;
    const rule = await management.create({
        merchantId: FRAK_MERCHANT_ID,
        name: params.name,
        expiresAt: params.expiresAt,
        rule: {
            trigger: params.trigger,
            conditions: params.conditions ?? [],
            rewards: params.rewards.map(([recipient, amount]) => ({
                recipient,
                type: "token",
                amountType: "fixed",
                amount,
            })),
            pendingRewardExpirationDays: positive("unlock-days"),
            maxRewardsPerUser: params.maxRewardsPerUser,
            holdUntilReleased: true,
        },
        budgetConfig: [
            {
                label: "total",
                durationInSeconds: null,
                amount: positive("budget"),
            },
        ],
    });
    return management.publish(rule.id);
}

async function seedMerchant() {
    const existing =
        await MerchantContext.repositories.merchant.findById(FRAK_MERCHANT_ID);
    if (existing) {
        console.log(`Frak merchant already seeded (${existing.domain})`);
        return;
    }
    const owner = required("owner");
    const merchant = await MerchantContext.repositories.merchant.create({
        id: FRAK_MERCHANT_ID,
        domain: required("domain"),
        name: "Frak",
        ...(isAddress(owner)
            ? { ownerWallet: owner }
            : { ownerAccountId: owner }),
        bankAddress: FRAK_SHARED_CAMPAIGN_BANK,
        defaultRewardToken: currentStablecoins.eure,
        verifiedAt: new Date(),
    });
    console.log(`Seeded Frak merchant ${merchant.id} on ${merchant.domain}`);
}

async function createSignupRule() {
    await requireFrakMerchant();
    const rule = await publishRule({
        name: "Frak Game: referral signup",
        trigger: "referral_signup",
        rewards: [
            ["referrer", positive("referrer")],
            ["referee", positive("referee")],
        ],
    });
    console.log(`Published signup rule ${rule.id}`);
}

async function findFrakCode(raw: string) {
    const code =
        await ReferralCodeContext.repositories.referralCode.findByCode(raw);
    if (code?.kind !== "frak") fail(`No active Frak code ${raw.toUpperCase()}`);
    return code;
}

async function createGame() {
    await requireFrakMerchant();
    const code = await findFrakCode(required("code"));
    if (await GameContext.repositories.game.findByReferralCodeId(code.id)) {
        fail(`Code ${code.code} already has a game`);
    }
    const startsAt = date("starts");
    const endsAt = date("ends");
    if (endsAt <= startsAt) fail("--ends must be after --starts");
    const prizeAmount = positive("prize-amount");

    const now = new Date();
    const overlapping = (await GameContext.repositories.game.list()).find(
        (game) =>
            game.endsAt > now &&
            game.startsAt < endsAt &&
            startsAt < game.endsAt
    );
    if (overlapping) fail(`The window overlaps game ${overlapping.id}`);

    const gameId = randomUUID();
    const rule = await publishRule({
        name: `Frak Game ${code.code}`,
        trigger: "game_join",
        rewards: [["referee", positive("reward")]],
        conditions: [
            { field: "game.id", operator: "eq", value: gameId },
            { field: "game.newcomer", operator: "eq", value: true },
        ],
        maxRewardsPerUser: 1,
        expiresAt: new Date(endsAt.getTime() + GAME_RULE_GRACE_MS),
    });
    const game = await GameContext.repositories.game.create({
        id: gameId,
        referralCodeId: code.id,
        campaignRuleId: rule.id,
        sponsorMerchantId: opts.sponsor ?? null,
        prizeAmount,
        prizeDescription: opts.prize ?? null,
        startsAt,
        endsAt,
    });
    console.log(`Opened game ${game.id} on ${code.code} (rule ${rule.id})`);
}

async function listGames() {
    const games = await GameContext.repositories.game.list();
    const rows = await Promise.all(
        games.map(async (game) => {
            const [code, rule] = await Promise.all([
                ReferralCodeContext.repositories.referralCode.findById(
                    game.referralCodeId
                ),
                CampaignContext.repositories.campaignRule.findById(
                    game.campaignRuleId
                ),
            ]);
            const draw = await GameContext.repositories.gameDraw.findByGameId(
                game.id
            );
            return {
                code: code?.code ?? "?",
                status: game.status,
                draw: draw?.status ?? "-",
                startsAt: game.startsAt.toISOString(),
                endsAt: game.endsAt.toISOString(),
                ruleStatus: rule?.status ?? "?",
                budgetUsed: JSON.stringify(rule?.budgetUsed ?? {}),
                prizeAmount: game.prizeAmount,
                prize: game.prizeDescription,
            };
        })
    );
    console.table(rows);
}

async function setGameStatus(raw: string | undefined, status: GameStatus) {
    if (!raw) fail(USAGE);
    const code = await findFrakCode(raw);
    const game = await GameContext.repositories.game.setStatus(code.id, status);
    if (!game) fail(`No game on code ${code.code}`);
    console.log(`Game ${code.code} is now ${status}`);
}

async function findGameByCode(raw: string | undefined) {
    if (!raw) fail(USAGE);
    const code = await findFrakCode(raw);
    const game = await GameContext.repositories.game.findByReferralCodeId(
        code.id
    );
    if (!game) fail(`No game on code ${code.code}`);
    return game;
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
    const game = await findGameByCode(raw);
    const { draw, candidate } =
        await OrchestrationContext.orchestrators.gameDraw.review(game.id);
    console.table({
        status: draw.status,
        frozenAt: draw.frozenAt.toISOString(),
        snapshotRoot: draw.snapshotRoot,
        totalTickets: draw.totalTickets,
        participants: draw.entries.length,
        discarded: draw.entries.filter((e) => e.discarded).length,
        drandRound: draw.drandRound,
        roundTime: drandRoundTime(draw.drandRound).toISOString(),
        beacon: draw.drandSignature ? "recorded" : "waiting",
        candidates: draw.candidates?.length ?? 0,
        rejections: draw.rejections.length,
    });
    for (const rejection of draw.rejections) {
        console.log(
            `rejected ${rejection.pid}: ${rejection.reason} by ${rejection.actor} at ${rejection.at}`
        );
    }
    if (!candidate) return;
    console.log(`\nCandidate #${candidate.rank + 1} (${candidate.pid})`);
    console.table({
        identityGroupId: candidate.identityGroupId,
        wallet: candidate.wallet ?? "none",
        accountCreatedAt: candidate.accountCreatedAt?.toISOString() ?? "?",
        instagram: candidate.instagram?.username ?? "not linked",
        followsNow: candidate.instagram?.follows ?? false,
        drawTickets: candidate.entry.drawTickets,
        ...candidate.entry.tickets,
    });
}

async function freezeDraw(raw: string | undefined) {
    const game = await findGameByCode(raw);
    const draw = await OrchestrationContext.orchestrators.gameDraw.freeze(game);
    console.log(
        `Draw ${draw.status}: root ${draw.snapshotRoot}, ${draw.totalTickets} tickets, drand round ${draw.drandRound} at ${drandRoundTime(draw.drandRound).toISOString()}`
    );
}

async function runDraws() {
    const result = await OrchestrationContext.orchestrators.gameDraw.runDue();
    console.log(`Frozen ${result.frozen}, drawn ${result.drawn}`);
}

async function rejectCandidate(raw: string | undefined) {
    const game = await findGameByCode(raw);
    const draw = await OrchestrationContext.orchestrators.gameDraw.reject(
        game.id,
        rejectionReason(),
        actor()
    );
    console.log(
        draw.status === "void"
            ? "Last candidate rejected: the draw has no winner"
            : `Rejected; candidate #${draw.rejections.length + 1} is now under review`
    );
}

async function confirmWinner(raw: string | undefined) {
    const game = await findGameByCode(raw);
    const draw = await OrchestrationContext.orchestrators.gameDraw.confirm(
        game.id,
        actor()
    );
    console.log(
        `Confirmed ${draw.winnerIdentityGroupId}: prize queued as asset log ${draw.assetLogId}`
    );
}

const [command, action, arg, drawArg] = positionals;
if (command === "merchant") await seedMerchant();
else if (command === "signup-rule") await createSignupRule();
else if (command === "game" && action === "create") await createGame();
else if (command === "game" && action === "list") await listGames();
else if (command === "game" && action === "pause")
    await setGameStatus(arg, "paused");
else if (command === "game" && action === "resume")
    await setGameStatus(arg, "active");
else if (command === "game" && action === "draw") await drawCommand();
else fail(USAGE);

async function drawCommand() {
    if (arg === "show") await showDraw(drawArg);
    else if (arg === "freeze") await freezeDraw(drawArg);
    else if (arg === "run") await runDraws();
    else if (arg === "reject") await rejectCandidate(drawArg);
    else if (arg === "confirm") await confirmWinner(drawArg);
    else fail(USAGE);
}
process.exit(0);
