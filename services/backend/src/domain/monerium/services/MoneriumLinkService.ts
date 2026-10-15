import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { MONERIUM_ADDRESS_LINKING_MESSAGE } from "@frak-labs/app-essentials/monerium";
import type { Address, Hex } from "viem";
import { requireMoneriumConfig } from "../config";
import {
    connectionErrorFor,
    MoneriumApiError,
    notConnected,
    profileNotApproved,
    reauthRequired,
    rethrowUpstream,
} from "../errors";
import type { MoneriumConnectionRepository } from "../repositories/MoneriumConnectionRepository";
import { type MoneriumWalletLinkState, moneriumErrorCodes } from "../schemas";
import type { MoneriumApiClient } from "./MoneriumApiClient";
import type { MoneriumStatusService } from "./MoneriumStatusService";
import type { MoneriumTokenService } from "./MoneriumTokenService";

const ALREADY_LINKED = /already/i;

function linkRejected(): HttpError {
    return HttpError.unprocessable(
        moneriumErrorCodes.linkRejected,
        "Monerium refused to link this wallet"
    );
}

export class MoneriumLinkService {
    constructor(
        private readonly connections: MoneriumConnectionRepository,
        private readonly tokens: MoneriumTokenService,
        private readonly client: MoneriumApiClient,
        private readonly status: MoneriumStatusService
    ) {}

    async linkWallet(params: {
        wallet: Address;
        signature: Hex;
    }): Promise<{ walletLink: MoneriumWalletLinkState }> {
        const config = requireMoneriumConfig();
        const profileId = await this.requireApprovedProfile(params.wallet);

        let walletLink: MoneriumWalletLinkState;
        try {
            const outcome = await this.tokens.withAccessToken(
                params.wallet,
                (accessToken) =>
                    this.client.linkAddress(accessToken, {
                        profile: profileId,
                        address: params.wallet,
                        chain: config.chain,
                        message: MONERIUM_ADDRESS_LINKING_MESSAGE,
                        signature: params.signature,
                    })
            );
            walletLink = outcome === "accepted" ? "pending" : "linked";
        } catch (error) {
            if (!(error instanceof MoneriumApiError)) throw error;
            if (error.isUpstreamFailure) return rethrowUpstream(error);
            const connectionError = connectionErrorFor(error);
            if (connectionError) throw connectionError;
            if (!ALREADY_LINKED.test(error.message)) {
                log.warn(
                    { status: error.status, moneriumCode: error.moneriumCode },
                    "[Monerium] wallet link refused"
                );
                throw linkRejected();
            }
            walletLink = await this.confirmAlreadyLinked(params.wallet);
        }

        await this.connections.update(params.wallet, {
            walletLinkState: walletLink,
            walletLinkPendingAt: walletLink === "pending" ? new Date() : null,
        });
        return { walletLink };
    }

    /** "Already linked" may mean linked to somebody else, so only our own profile's record counts. */
    private async confirmAlreadyLinked(
        wallet: Address
    ): Promise<MoneriumWalletLinkState> {
        try {
            const { after } = await this.status.refreshFromMonerium(wallet);
            if (after.walletLinkState === "linked") return "linked";
        } catch (error) {
            if (error instanceof HttpError) throw error;
            rethrowUpstream(error);
        }
        throw linkRejected();
    }

    /** The cached profile may predate its approval, so a miss is re-checked once upstream. */
    private async requireApprovedProfile(wallet: Address): Promise<string> {
        let row = await this.connections.findByWallet(wallet);
        if (!row) throw notConnected();
        if (row.status === "reauth_required") throw reauthRequired();

        if (row.profileState !== "approved") {
            try {
                row = (await this.status.refreshFromMonerium(wallet)).after;
            } catch (error) {
                if (error instanceof HttpError) throw error;
                rethrowUpstream(error);
            }
        }
        if (row.profileState !== "approved" || !row.profileId) {
            throw profileNotApproved();
        }
        return row.profileId;
    }
}
