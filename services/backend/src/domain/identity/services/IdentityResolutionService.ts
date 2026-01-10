import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import type { IdentityRepository } from "../repositories/IdentityRepository";

type IdentityType = "anonymous_fingerprint" | "merchant_customer" | "wallet";

export class IdentityResolutionService {
    constructor(readonly repository: IdentityRepository) {}

    async resolveAnonymousId(params: {
        anonId: string;
        merchantId: string;
    }): Promise<{ identityGroupId: string; isNew: boolean }> {
        const existingGroup = await this.repository.findGroupByIdentity({
            type: "anonymous_fingerprint",
            value: params.anonId,
            merchantId: params.merchantId,
        });

        if (existingGroup) {
            return { identityGroupId: existingGroup.id, isNew: false };
        }

        const newGroup = await this.repository.createGroup();
        await this.repository.addNode({
            groupId: newGroup.id,
            type: "anonymous_fingerprint",
            value: params.anonId,
            merchantId: params.merchantId,
        });

        log.debug(
            { groupId: newGroup.id, anonId: params.anonId },
            "Created new identity group for anonymous user"
        );

        return { identityGroupId: newGroup.id, isNew: true };
    }

    async findByIdentifier(params: {
        type: IdentityType;
        value: string;
        merchantId?: string;
    }): Promise<{
        id: string;
        wallet: Address | null;
    } | null> {
        const group = await this.repository.findGroupByIdentity(params);
        if (!group) return null;

        const wallet = await this.repository.getWalletForGroup(group.id);

        return {
            id: group.id,
            wallet,
        };
    }
}
