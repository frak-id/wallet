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
import type { GameStatus } from "../src/domain/game/schemas";
import { FRAK_MERCHANT_ID } from "../src/domain/merchant/constants";
import { MerchantContext } from "../src/domain/merchant/context";
import { FRAK_SHARED_CAMPAIGN_BANK } from "../src/domain/merchant/services/MerchantRegistrationService";
import { ReferralCodeContext } from "../src/domain/referral-code";

const USAGE = `Usage: bun scripts/frakGame.ts <command> [options]
  merchant --owner <0xWallet|accountId> --domain <domain>
      seed the Frak merchant on the shared campaign bank (idempotent)
  signup-rule --referrer <amount> --referee <amount> --budget <amount> [--unlock-days 30]
      publish the referral signup rule (pause it from the business dashboard)
  game create --code <CODE> --reward <amount> --budget <amount> --starts <iso> --ends <iso> --prize-amount <eur>
              [--prize <text>] [--sponsor <merchantId>] [--unlock-days 30]
      open a game on a Frak code issued with scripts/frakReferralCode.ts
  game list | game pause <CODE> | game resume <CODE>
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
            return {
                code: code?.code ?? "?",
                status: game.status,
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

const [command, action, arg] = positionals;
if (command === "merchant") await seedMerchant();
else if (command === "signup-rule") await createSignupRule();
else if (command === "game" && action === "create") await createGame();
else if (command === "game" && action === "list") await listGames();
else if (command === "game" && action === "pause")
    await setGameStatus(arg, "paused");
else if (command === "game" && action === "resume")
    await setGameStatus(arg, "active");
else fail(USAGE);
process.exit(0);
