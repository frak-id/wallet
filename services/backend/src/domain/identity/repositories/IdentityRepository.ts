import { db } from "@backend-infrastructure";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Address } from "viem";
import {
    identityGroupsTable,
    identityNodesTable,
    type identityTypeEnum,
    type PendingPurchaseValidation,
} from "../db/schema";

type IdentityType = (typeof identityTypeEnum.enumValues)[number];
type IdentityGroupSelect = typeof identityGroupsTable.$inferSelect;
type IdentityNodeSelect = typeof identityNodesTable.$inferSelect;

export class IdentityRepository {
    async findGroupById(id: string): Promise<IdentityGroupSelect | null> {
        const result = await db.query.identityGroupsTable.findFirst({
            where: eq(identityGroupsTable.id, id),
        });
        return result ?? null;
    }

    async findGroupByIdentity(params: {
        type: IdentityType;
        value: string;
        merchantId?: string;
    }): Promise<IdentityGroupSelect | null> {
        const node = await db.query.identityNodesTable.findFirst({
            where: and(
                eq(identityNodesTable.identityType, params.type),
                eq(identityNodesTable.identityValue, params.value),
                params.merchantId
                    ? eq(identityNodesTable.merchantId, params.merchantId)
                    : undefined
            ),
        });
        if (!node) return null;

        return this.findGroupById(node.groupId);
    }

    async getWalletForGroup(groupId: string): Promise<Address | null> {
        const walletNode = await db.query.identityNodesTable.findFirst({
            where: and(
                eq(identityNodesTable.groupId, groupId),
                eq(identityNodesTable.identityType, "wallet")
            ),
        });
        return (walletNode?.identityValue as Address) ?? null;
    }

    async hasWallet(groupId: string): Promise<boolean> {
        const wallet = await this.getWalletForGroup(groupId);
        return wallet !== null;
    }

    async createGroup(): Promise<IdentityGroupSelect> {
        const [result] = await db
            .insert(identityGroupsTable)
            .values({})
            .returning();
        if (!result) {
            throw new Error("Failed to create identity group");
        }
        return result;
    }

    async addNode(params: {
        groupId: string;
        type: IdentityType;
        value: string;
        merchantId?: string;
        validationData?: PendingPurchaseValidation;
    }): Promise<IdentityNodeSelect> {
        const [result] = await db
            .insert(identityNodesTable)
            .values({
                groupId: params.groupId,
                identityType: params.type,
                identityValue: params.value,
                merchantId: params.merchantId,
                validationData: params.validationData,
            })
            .onConflictDoNothing()
            .returning();

        if (!result) {
            const existing = await db.query.identityNodesTable.findFirst({
                where: and(
                    eq(identityNodesTable.identityType, params.type),
                    eq(identityNodesTable.identityValue, params.value),
                    params.merchantId
                        ? eq(identityNodesTable.merchantId, params.merchantId)
                        : undefined
                ),
            });
            if (!existing) {
                throw new Error("Failed to create identity node");
            }
            return existing;
        }
        return result;
    }

    async findNodeWithPendingValidation(params: {
        type: IdentityType;
        value: string;
        merchantId: string;
    }): Promise<IdentityNodeSelect | null> {
        const node = await db.query.identityNodesTable.findFirst({
            where: and(
                eq(identityNodesTable.identityType, params.type),
                eq(identityNodesTable.identityValue, params.value),
                eq(identityNodesTable.merchantId, params.merchantId),
                isNotNull(identityNodesTable.validationData)
            ),
        });
        return node ?? null;
    }

    async clearValidationData(nodeId: string): Promise<void> {
        await db
            .update(identityNodesTable)
            .set({ validationData: null })
            .where(eq(identityNodesTable.id, nodeId));
    }

    async getNodesForGroup(groupId: string): Promise<IdentityNodeSelect[]> {
        return db.query.identityNodesTable.findMany({
            where: eq(identityNodesTable.groupId, groupId),
        });
    }

    async moveNodesToGroup(
        fromGroupId: string,
        toGroupId: string
    ): Promise<number> {
        const result = await db
            .update(identityNodesTable)
            .set({ groupId: toGroupId })
            .where(eq(identityNodesTable.groupId, fromGroupId));
        return result.count;
    }

    async deleteGroup(groupId: string): Promise<void> {
        await db
            .delete(identityGroupsTable)
            .where(eq(identityGroupsTable.id, groupId));
    }
}
