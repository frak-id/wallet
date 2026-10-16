import { HttpError } from "@backend-utils";
import { isMoneriumOwnPayoutAvailable } from "@frak-labs/app-essentials/monerium";
import { type Address, isAddressEqual } from "viem";
import { requireMoneriumConfig } from "../config";
import type {
    MoneriumConnectionRow,
    MoneriumTrackedOrderRow,
} from "../db/schema";
import {
    MoneriumApiError,
    profileNotApproved,
    refusalError,
    requireConnectedRow,
    rethrowUpstream,
} from "../errors";
import type { MoneriumConnectionRepository } from "../repositories/MoneriumConnectionRepository";
import type { MoneriumTrackedOrderRepository } from "../repositories/MoneriumTrackedOrderRepository";
import {
    type MoneriumBeneficiaryDto,
    type MoneriumOrderDto,
    type MoneriumPlaceOrderBody,
    moneriumErrorCodes,
} from "../schemas";
import type {
    MoneriumApiClient,
    MoneriumOrderRecord,
} from "./MoneriumApiClient";
import type { MoneriumStatusService } from "./MoneriumStatusService";
import type { MoneriumTokenService } from "./MoneriumTokenService";
import {
    deriveBeneficiaries,
    sortNewestFirst,
    toOrderDto,
} from "./orderMapping";
import { validateRedeemOrder } from "./orderValidation";
import { TtlCoalescer } from "./TtlCoalescer";

type PlaceOrderResult = {
    orderId: string;
    order: MoneriumOrderDto | null;
};

function orderIdTaken(): HttpError {
    return HttpError.conflict(
        moneriumErrorCodes.orderRejected,
        "This order id is already used"
    );
}

const ORDER_LIST_COALESCE_MS = 5_000;
const UNKNOWN_ORDER_MAX_AGE_MS = 60 * 60_000;
const ACCEPTED_ORDER_MAX_AGE_MS = 24 * 60 * 60_000;

function orderRejected(): HttpError {
    return HttpError.unprocessable(
        moneriumErrorCodes.orderRejected,
        "Monerium refused the order"
    );
}

function walletNotLinked(): HttpError {
    return HttpError.conflict(
        moneriumErrorCodes.walletNotLinked,
        "This wallet is not linked to the Monerium account yet"
    );
}

function isLinked(row: MoneriumConnectionRow): boolean {
    return row.walletLinkState === "linked";
}

/** Monerium answers a bare 400 otherwise: an own payout reuses the profile's approved identity. */
function canPayOwn(row: MoneriumConnectionRow): boolean {
    return isMoneriumOwnPayoutAvailable(row.profileState);
}

export class MoneriumOrderService {
    private readonly orderLists = new TtlCoalescer<MoneriumOrderRecord[]>(
        ORDER_LIST_COALESCE_MS
    );

    constructor(
        private readonly connections: MoneriumConnectionRepository,
        private readonly trackedOrders: MoneriumTrackedOrderRepository,
        private readonly tokens: MoneriumTokenService,
        private readonly client: MoneriumApiClient,
        private readonly status: MoneriumStatusService
    ) {}

    async listOrders(wallet: Address): Promise<MoneriumOrderDto[]> {
        const records = await this.fetchOrders(wallet);
        return sortNewestFirst(records.map(toOrderDto));
    }

    /** Past payout targets the wallet can reuse: third parties without a usable name are left out. */
    async listBeneficiaries(
        wallet: Address
    ): Promise<MoneriumBeneficiaryDto[]> {
        return deriveBeneficiaries(await this.listOrders(wallet));
    }

    /** Idempotent on `body.orderId`: a retry returns the order instead of paying twice. */
    async placeOrder(params: {
        wallet: Address;
        body: MoneriumPlaceOrderBody;
    }): Promise<PlaceOrderResult> {
        const { wallet, body } = params;
        const connection = await this.connections.findByWallet(wallet);
        requireConnectedRow(connection);

        const known = await this.trackedOrders.findById(body.orderId);
        if (known && !isAddressEqual(known.wallet, wallet)) {
            throw orderIdTaken();
        }
        if (known) {
            const existing = await this.findExistingOrder(wallet, body.orderId);
            if (existing) return { orderId: body.orderId, order: existing };
        }

        const order = validateRedeemOrder(
            body,
            new Date(),
            connection.profileKind
        );
        const linked = await this.status.recheck(wallet, connection, isLinked);
        if (!linked) throw walletNotLinked();
        if (order.own) {
            // A refresh made for the link already brought the latest profile state.
            const approved =
                linked === connection
                    ? (await this.status.recheck(wallet, linked, canPayOwn)) !==
                      null
                    : canPayOwn(linked);
            if (!approved) throw profileNotApproved();
        }
        const config = requireMoneriumConfig();

        const inserted =
            !known && (await this.trackNewOrder(wallet, body, order.amount));

        try {
            const outcome = await this.tokens.withAccessToken(
                wallet,
                (accessToken) =>
                    this.client.placeRedeemOrder(accessToken, {
                        id: body.orderId,
                        address: wallet,
                        chain: config.chain,
                        amount: order.amount,
                        iban: order.iban,
                        details: order.details,
                        message: body.message,
                        signature: body.signature,
                        memo: order.memo,
                    })
            );
            this.orderLists.invalidate(wallet.toLowerCase());
            if (outcome.kind === "accepted") {
                await this.trackedOrders.markPlacementAccepted(body.orderId);
                return { orderId: body.orderId, order: null };
            }
            const dto = toOrderDto(outcome.order);
            if (dto.state !== "placed") {
                await this.trackedOrders.transition(
                    body.orderId,
                    "placed",
                    dto.state
                );
            }
            return { orderId: body.orderId, order: dto };
        } catch (error) {
            return this.handlePlacementFailure(error, {
                wallet,
                orderId: body.orderId,
                created: inserted,
            });
        }
    }

    /** Current Monerium view of a tracked order, or null when Monerium does not know it (yet). */
    private async fetchTrackedOrder(
        tracked: Pick<MoneriumTrackedOrderRow, "id" | "wallet">
    ): Promise<MoneriumOrderDto | null> {
        try {
            const record = await this.tokens.withAccessToken(
                tracked.wallet,
                (accessToken) => this.client.getOrder(accessToken, tracked.id)
            );
            return toOrderDto(record);
        } catch (error) {
            if (error instanceof MoneriumApiError && error.status === 404) {
                return null;
            }
            throw error;
        }
    }

    /** Mirrors Monerium's state into the tracked row; returns the new state only to the caller that moved it. */
    async syncTrackedOrder(
        tracked: MoneriumTrackedOrderRow
    ): Promise<MoneriumOrderDto["state"] | null> {
        const order = await this.fetchTrackedOrder(tracked);
        if (!order) {
            await this.dropOrKeepUnknown(tracked);
            return null;
        }
        if (order.state === tracked.state) {
            await this.trackedOrders.markChecked(tracked.id);
            return null;
        }
        const moved = await this.trackedOrders.transition(
            tracked.id,
            tracked.state,
            order.state
        );
        return moved ? order.state : null;
    }

    /** Monerium never heard of it: a failed placement is forgotten after an hour, an accepted (202) one after a day. */
    private async dropOrKeepUnknown(
        tracked: MoneriumTrackedOrderRow
    ): Promise<void> {
        const maxAgeMs = tracked.placementAccepted
            ? ACCEPTED_ORDER_MAX_AGE_MS
            : UNKNOWN_ORDER_MAX_AGE_MS;
        if (Date.now() - tracked.createdAt.getTime() > maxAgeMs) {
            await this.trackedOrders.deleteById(tracked.id);
            return;
        }
        await this.trackedOrders.markChecked(tracked.id);
    }

    /** False when the id was already tracked for this wallet; another wallet's row is a conflict. */
    private async trackNewOrder(
        wallet: Address,
        body: MoneriumPlaceOrderBody,
        amount: string
    ): Promise<boolean> {
        const inserted = await this.trackedOrders.insertIfAbsent({
            id: body.orderId,
            wallet,
            amount,
            state: "placed",
        });
        if (inserted) return true;
        const winner = await this.trackedOrders.findById(body.orderId);
        if (winner && !isAddressEqual(winner.wallet, wallet)) {
            throw orderIdTaken();
        }
        return false;
    }

    /** An `HttpError` was raised before Monerium saw the order, so the row this call created is dropped. */
    private async handlePlacementFailure(
        error: unknown,
        context: { wallet: Address; orderId: string; created: boolean }
    ): Promise<PlaceOrderResult> {
        if (!(error instanceof MoneriumApiError)) {
            if (error instanceof HttpError && context.created) {
                await this.trackedOrders.deleteById(context.orderId);
            }
            throw error;
        }
        if (error.status === 409) {
            const existing = await this.findExistingOrder(
                context.wallet,
                context.orderId
            );
            if (existing) return { orderId: context.orderId, order: existing };
        }
        const refusal = refusalError(error, orderRejected, "order");
        if (!error.isUpstreamFailure && context.created) {
            await this.trackedOrders.deleteById(context.orderId);
        }
        throw refusal;
    }

    private findExistingOrder(
        wallet: Address,
        orderId: string
    ): Promise<MoneriumOrderDto | null> {
        return this.fetchTrackedOrder({ id: orderId, wallet }).catch(
            rethrowUpstream
        );
    }

    private async fetchOrders(wallet: Address) {
        requireConnectedRow(await this.connections.findByWallet(wallet));
        return this.orderLists
            .run(wallet.toLowerCase(), () =>
                this.tokens.withAccessToken(wallet, (accessToken) =>
                    this.client.listOrders(accessToken, { address: wallet })
                )
            )
            .catch(rethrowUpstream);
    }
}
