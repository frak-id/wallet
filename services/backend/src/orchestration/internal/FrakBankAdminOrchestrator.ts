import {
    eventEmitter,
    type TokenMetadataRepository,
} from "@backend-infrastructure";
import { currentStablecoins, type Stablecoin } from "@frak-labs/app-essentials";
import { type Address, isAddressEqual, parseUnits } from "viem";
import type { CampaignBankRepository } from "../../domain/campaign-bank/repositories/CampaignBankRepository";
import type { GameDrawRepository } from "../../domain/game/repositories/GameDrawRepository";
import type { GameRepository } from "../../domain/game/repositories/GameRepository";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import { FRAK_SHARED_CAMPAIGN_BANK } from "../../domain/merchant/services/MerchantRegistrationService";
import type {
    AssetLogRepository,
    OwedByBankRow,
    PayoutStateRow,
} from "../../domain/rewards/repositories/AssetLogRepository";
import type { SettlementOrchestrator } from "../SettlementOrchestrator";
import type {
    BankOwed,
    FrakBank,
    PayoutState,
} from "../schemas/internalSchemas";

const PRIZES_LIMIT = 20;
const BUCKETS = ["due", "depleted", "processing", "later"] as const;

type WeiOwed = Record<
    (typeof BUCKETS)[number],
    { amount: bigint; count: number }
>;

const STABLECOINS = Object.entries(currentStablecoins) as [
    Stablecoin,
    Address,
][];

function emptyOwed(): WeiOwed {
    return {
        due: { amount: 0n, count: 0 },
        depleted: { amount: 0n, count: 0 },
        processing: { amount: 0n, count: 0 },
        later: { amount: 0n, count: 0 },
    };
}

function addOwed(into: WeiOwed, row: OwedByBankRow, decimals: number): void {
    for (const bucket of BUCKETS) {
        into[bucket].amount += parseUnits(row[bucket].amount, decimals);
        into[bucket].count += row[bucket].count;
    }
}

function owedJson(owed: WeiOwed): BankOwed {
    const bucket = ({ amount, count }: WeiOwed["due"]) => ({
        amount: amount.toString(),
        count,
    });
    return {
        due: bucket(owed.due),
        depleted: bucket(owed.depleted),
        processing: bucket(owed.processing),
        later: bucket(owed.later),
    };
}

function hasOwed(owed: WeiOwed): boolean {
    return BUCKETS.some((bucket) => owed[bucket].count > 0);
}

type Coin = { symbol: Stablecoin; token: Address; decimals: number };

type BankState = Awaited<
    ReturnType<CampaignBankRepository["getBankOnChainState"]>
>;

/** `null` for a token nobody funded, authorized nor owes, except EURe which always shows. */
function tokenLine(
    coin: Coin,
    owedRows: OwedByBankRow[],
    state: BankState
): FrakBank["tokens"][number] | null {
    const owed = emptyOwed();
    for (const row of owedRows) {
        if (isAddressEqual(row.tokenAddress, coin.token)) {
            addOwed(owed, row, coin.decimals);
        }
    }
    const balance = state.balances.get(coin.token) ?? 0n;
    const allowance = state.allowances.get(coin.token) ?? 0n;
    const funded = balance > 0n || allowance > 0n;
    if (coin.symbol !== "eure" && !funded && !hasOwed(owed)) return null;

    const cap = balance < allowance ? balance : allowance;
    const payable = state.isOpen ? cap : 0n;
    const toPay = owed.due.amount + owed.depleted.amount;
    return {
        symbol: coin.symbol,
        address: coin.token,
        decimals: coin.decimals,
        balance: balance.toString(),
        allowance: allowance.toString(),
        payable: payable.toString(),
        owed: owedJson(owed),
        shortfall: (toPay > payable ? toPay - payable : 0n).toString(),
    };
}

/** One line per merchant and token, the largest amount to pay first. */
function merchantLines(
    owedRows: OwedByBankRow[],
    coins: Coin[],
    merchantOf: Map<string, { name: string; domain: string }>
): FrakBank["merchants"] {
    const lines = owedRows.flatMap((row) => {
        const coin = coins.find((c) =>
            isAddressEqual(c.token, row.tokenAddress)
        );
        if (!coin) return [];
        const owed = emptyOwed();
        addOwed(owed, row, coin.decimals);
        const merchant = merchantOf.get(row.merchantId);
        const line = {
            merchantId: row.merchantId,
            name: merchant?.name ?? "",
            domain: merchant?.domain ?? "",
            symbol: coin.symbol,
            owed: owedJson(owed),
        };
        return [{ line, toPay: owed.due.amount + owed.depleted.amount }];
    });
    lines.sort((a, b) => (a.toPay < b.toPay ? 1 : -1));
    return lines.map(({ line }) => line);
}

export function toPayoutState(row: PayoutStateRow): PayoutState {
    return {
        status: row.status,
        amount: row.amount,
        txHash: row.txHash,
        statusChangedAt: row.statusChangedAt,
        settledAt: row.settledAt,
        expiresAt: row.expiresAt,
        lastError: row.lastError,
    };
}

/** The bank paying Frak's rewards and prizes, shared with every brand opted into it. */
export class FrakBankAdminOrchestrator {
    constructor(
        private readonly merchants: MerchantRepository,
        private readonly banks: CampaignBankRepository,
        private readonly assetLogs: AssetLogRepository,
        private readonly games: GameRepository,
        private readonly draws: GameDrawRepository,
        private readonly tokenMetadata: TokenMetadataRepository,
        private readonly settlement: SettlementOrchestrator
    ) {}

    /** What the bank holds against what it owes; `shortfall` is what settlement cannot pay right now. */
    async overview(now = new Date()): Promise<FrakBank> {
        const frak = await this.merchants.findById(FRAK_MERCHANT_ID);
        const address = frak?.bankAddress ?? FRAK_SHARED_CAMPAIGN_BANK;
        // A top-up made a minute ago must show, not the 10 min cached read.
        this.banks.clearOnChainCache(address);
        const [state, owedRows, decimals, prizes] = await Promise.all([
            this.banks.getBankOnChainState(
                address,
                STABLECOINS.map(([, token]) => token)
            ),
            this.assetLogs.sumOwedByBank(address, now),
            Promise.all(
                STABLECOINS.map(([, token]) =>
                    this.tokenMetadata.getDecimals({ token })
                )
            ),
            this.prizes(),
        ]);
        const coins: Coin[] = STABLECOINS.map(([symbol, token], index) => ({
            symbol,
            token,
            decimals: decimals[index] ?? 18,
        }));
        const merchantRows = await this.merchants.findByIds([
            ...new Set(owedRows.map((row) => row.merchantId)),
        ]);

        return {
            address,
            isOpen: state.isOpen,
            checkedAt: now,
            tokens: coins.flatMap((coin) => {
                const line = tokenLine(coin, owedRows, state);
                return line ? [line] : [];
            }),
            merchants: merchantLines(
                owedRows,
                coins,
                new Map(merchantRows.map((m) => [m.id, m]))
            ),
            prizes,
        };
    }

    /** Runs the 3-hourly bank re-check now, then wakes settlement for whatever is payable. */
    async recheck(): Promise<{ requeued: number }> {
        const { requeuedCount } =
            await this.settlement.requeueDepletedRewards();
        // A requeue already woke settlement; pending rows otherwise wait for its hourly pass.
        if (requeuedCount === 0) {
            eventEmitter.emit("newPendingRewards", { count: 0 });
        }
        return { requeued: requeuedCount };
    }

    private async prizes(): Promise<FrakBank["prizes"]> {
        const confirmed = await this.draws.findConfirmedPayouts(PRIZES_LIMIT);
        const [games, payouts] = await Promise.all([
            this.games.findByIds(confirmed.map((draw) => draw.gameId)),
            this.assetLogs.findPayoutStates(
                confirmed.map((draw) => draw.assetLogId)
            ),
        ]);
        const gameOf = new Map(games.map((game) => [game.id, game]));
        const payoutOf = new Map(payouts.map((payout) => [payout.id, payout]));
        return confirmed.flatMap((draw) => {
            const game = gameOf.get(draw.gameId);
            if (!game) return [];
            const payout = payoutOf.get(draw.assetLogId);
            return [
                {
                    gameId: draw.gameId,
                    prizeAmount: game.prizeAmount,
                    endsAt: game.endsAt,
                    confirmedAt: draw.confirmedAt,
                    payout: payout ? toPayoutState(payout) : null,
                },
            ];
        });
    }
}
