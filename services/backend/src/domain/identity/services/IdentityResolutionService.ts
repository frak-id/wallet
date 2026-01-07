import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import { IdentityRepository } from "../repositories/IdentityRepository";

type IdentityType = "anonymous_fingerprint" | "merchant_customer" | "wallet";

export class IdentityResolutionService {
    private repository: IdentityRepository;

    constructor(repository?: IdentityRepository) {
        this.repository = repository ?? new IdentityRepository();
    }

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

    async linkMerchantCustomer(params: {
        identityGroupId: string;
        merchantId: string;
        customerId: string;
        customerEmail?: string;
    }): Promise<void> {
        const existingGroup = await this.repository.findGroupByIdentity({
            type: "merchant_customer",
            value: params.customerId,
            merchantId: params.merchantId,
        });

        if (existingGroup && existingGroup.id !== params.identityGroupId) {
            await this.mergeGroups({
                anchorGroupId: existingGroup.walletAddress
                    ? existingGroup.id
                    : params.identityGroupId,
                mergingGroupId: existingGroup.walletAddress
                    ? params.identityGroupId
                    : existingGroup.id,
            });
            return;
        }

        await this.repository.addNode({
            groupId: params.identityGroupId,
            type: "merchant_customer",
            value: params.customerId,
            merchantId: params.merchantId,
        });

        log.debug(
            {
                groupId: params.identityGroupId,
                customerId: params.customerId,
            },
            "Linked merchant customer to identity group"
        );
    }

    async connectWallet(params: {
        identityGroupId: string;
        wallet: Address;
    }): Promise<{ merged: boolean; mergedFromGroupId?: string }> {
        const existingGroup = await this.repository.findGroupByWallet(
            params.wallet
        );

        if (existingGroup && existingGroup.id !== params.identityGroupId) {
            await this.mergeGroups({
                anchorGroupId: existingGroup.id,
                mergingGroupId: params.identityGroupId,
            });

            // TODO: Phase 6 - Call RewardsHub.resolveUserId(params.identityGroupId, params.wallet)

            return {
                merged: true,
                mergedFromGroupId: params.identityGroupId,
            };
        }

        await this.repository.updateGroupWallet(
            params.identityGroupId,
            params.wallet
        );
        await this.repository.addNode({
            groupId: params.identityGroupId,
            type: "wallet",
            value: params.wallet,
        });

        // TODO: Phase 6 - Call RewardsHub.resolveUserId(params.identityGroupId, params.wallet)

        log.debug(
            {
                groupId: params.identityGroupId,
                wallet: params.wallet,
            },
            "Connected wallet to identity group"
        );

        return { merged: false };
    }

    async findByIdentifier(params: {
        type: IdentityType;
        value: string;
        merchantId?: string;
    }): Promise<{
        id: string;
        walletAddress: Address | null;
    } | null> {
        const group = await this.repository.findGroupByIdentity(params);
        if (!group) return null;

        return {
            id: group.id,
            walletAddress: group.walletAddress as Address | null,
        };
    }

    private async mergeGroups(params: {
        anchorGroupId: string;
        mergingGroupId: string;
    }): Promise<void> {
        const movedCount = await this.repository.moveNodesToGroup(
            params.mergingGroupId,
            params.anchorGroupId
        );

        await this.repository.deleteGroup(params.mergingGroupId);

        log.debug(
            {
                anchorGroupId: params.anchorGroupId,
                mergingGroupId: params.mergingGroupId,
                movedNodes: movedCount,
            },
            "Merged identity groups"
        );
    }
}
