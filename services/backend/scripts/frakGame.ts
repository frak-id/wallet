import { parseArgs } from "node:util";
import { currentStablecoins } from "@frak-labs/app-essentials/blockchain";
import { isAddress } from "viem";
import { CampaignContext } from "../src/domain/campaign/context";
import type {
    CampaignTrigger,
    RewardDefinition,
} from "../src/domain/campaign/schemas";
import { GameContext } from "../src/domain/game/context";
import type { DropStatus } from "../src/domain/game/schemas";
import { FRAK_MERCHANT_ID } from "../src/domain/merchant/constants";
import { MerchantContext } from "../src/domain/merchant/context";
import { FRAK_SHARED_CAMPAIGN_BANK } from "../src/domain/merchant/services/MerchantRegistrationService";
import { ReferralCodeContext } from "../src/domain/referral-code";

const USAGE = `Usage: bun scripts/frakGame.ts <command> [options]
  merchant --owner <0xWallet|accountId> --domain <domain> [--name Frak]
      seed the Frak merchant on the shared campaign bank (idempotent)
  signup-rule --referrer <amount> --referee <amount> --budget <amount> [--unlock-days 30]
      publish the referral signup rule (pause it from the business dashboard)
  drop create --code <CODE> --reward <amount> --budget <amount> --starts <iso> --ends <iso> --prize <text>
              [--sponsor <merchantId>] [--unlock-days 30]
      open a drop on a Frak code issued with scripts/frakReferralCode.ts
  drop list | drop pause <CODE> | drop resume <CODE>
Amounts are in EURe. --unlock-days: how long a reward waits for the user's first mission.`;

const { values: opts, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
        owner: { type: "string" },
        domain: { type: "string" },
        name: { type: "string", default: "Frak" },
        referrer: { type: "string" },
        referee: { type: "string" },
        reward: { type: "string" },
        budget: { type: "string" },
        starts: { type: "string" },
        ends: { type: "string" },
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
}) {
    const management = CampaignContext.services.management;
    const rule = await management.create({
        merchantId: FRAK_MERCHANT_ID,
        name: params.name,
        rule: {
            trigger: params.trigger,
            conditions: [],
            rewards: params.rewards.map(([recipient, amount]) => ({
                recipient,
                type: "token",
                amountType: "fixed",
                amount,
            })),
            pendingRewardExpirationDays: positive("unlock-days"),
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
        name: opts.name ?? "Frak",
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

async function createDrop() {
    await requireFrakMerchant();
    const code = await findFrakCode(required("code"));
    if (await GameContext.repositories.drop.findByReferralCodeId(code.id)) {
        fail(`Code ${code.code} already has a drop`);
    }
    const startsAt = date("starts");
    const endsAt = date("ends");
    if (endsAt <= startsAt) fail("--ends must be after --starts");

    const rule = await publishRule({
        name: `Frak Game drop ${code.code}`,
        trigger: "drop_join",
        rewards: [["referee", positive("reward")]],
    });
    const drop = await GameContext.repositories.drop.create({
        referralCodeId: code.id,
        campaignRuleId: rule.id,
        sponsorMerchantId: opts.sponsor ?? null,
        prizeDescription: required("prize"),
        startsAt,
        endsAt,
    });
    console.log(`Opened drop ${drop.id} on ${code.code} (rule ${rule.id})`);
}

async function listDrops() {
    const drops = await GameContext.repositories.drop.list();
    const rows = await Promise.all(
        drops.map(async (drop) => {
            const [code, rule] = await Promise.all([
                ReferralCodeContext.repositories.referralCode.findById(
                    drop.referralCodeId
                ),
                CampaignContext.repositories.campaignRule.findById(
                    drop.campaignRuleId
                ),
            ]);
            return {
                code: code?.code ?? "?",
                status: drop.status,
                startsAt: drop.startsAt.toISOString(),
                endsAt: drop.endsAt.toISOString(),
                ruleStatus: rule?.status ?? "?",
                budgetUsed: JSON.stringify(rule?.budgetUsed ?? {}),
                prize: drop.prizeDescription,
            };
        })
    );
    console.table(rows);
}

async function setDropStatus(raw: string | undefined, status: DropStatus) {
    if (!raw) fail(USAGE);
    const code = await findFrakCode(raw);
    const drop = await GameContext.repositories.drop.setStatus(code.id, status);
    if (!drop) fail(`No drop on code ${code.code}`);
    console.log(`Drop ${code.code} is now ${status}`);
}

const [command, action, arg] = positionals;
if (command === "merchant") await seedMerchant();
else if (command === "signup-rule") await createSignupRule();
else if (command === "drop" && action === "create") await createDrop();
else if (command === "drop" && action === "list") await listDrops();
else if (command === "drop" && action === "pause")
    await setDropStatus(arg, "paused");
else if (command === "drop" && action === "resume")
    await setDropStatus(arg, "active");
else fail(USAGE);
process.exit(0);
