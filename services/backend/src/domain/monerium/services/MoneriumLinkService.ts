import { HttpError } from "@backend-utils";
import {
    isMoneriumProfileUsable,
    MONERIUM_ADDRESS_LINKING_MESSAGE,
} from "@frak-labs/app-essentials/monerium";
import type { Address, Hex } from "viem";
import { type MoneriumConfig, requireMoneriumConfig } from "../config";
import {
    connectionErrorFor,
    MoneriumApiError,
    profileNotApproved,
    refusalError,
    requireConnectedRow,
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

function isAlreadyLinked(error: MoneriumApiError): boolean {
    return (
        !error.isUpstreamFailure &&
        !connectionErrorFor(error) &&
        ALREADY_LINKED.test(error.message)
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
        const profileId = await this.requireUsableProfile(
            params.wallet,
            config.environment
        );

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
            if (!isAlreadyLinked(error)) {
                throw refusalError(error, linkRejected, "wallet link");
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
        const { after } = await this.status
            .refreshFromMonerium(wallet)
            .catch(rethrowUpstream);
        if (after.walletLinkState === "linked") return "linked";
        throw linkRejected();
    }

    /** The cached profile may predate its approval, so a miss is re-checked once upstream. */
    private async requireUsableProfile(
        wallet: Address,
        environment: MoneriumConfig["environment"]
    ): Promise<string> {
        const row = await this.connections.findByWallet(wallet);
        requireConnectedRow(row);
        const usable = await this.status.recheck(
            wallet,
            row,
            (candidate) =>
                isMoneriumProfileUsable(candidate.profileState, environment) &&
                candidate.profileId !== null
        );
        if (!usable?.profileId) throw profileNotApproved();
        return usable.profileId;
    }
}
