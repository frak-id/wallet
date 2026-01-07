import { db } from "@backend-infrastructure";
import { and, eq } from "drizzle-orm";
import type { Address } from "viem";
import {
    identityGroupsTable,
    identityNodesTable,
    type identityTypeEnum,
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

    async findGroupByWallet(
        wallet: Address
    ): Promise<IdentityGroupSelect | null> {
        const result = await db.query.identityGroupsTable.findFirst({
            where: eq(identityGroupsTable.walletAddress, wallet),
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

    async createGroup(wallet?: Address): Promise<IdentityGroupSelect> {
        const [result] = await db
            .insert(identityGroupsTable)
            .values({ walletAddress: wallet })
            .returning();
        if (!result) {
            throw new Error("Failed to create identity group");
        }
        return result;
    }

    async updateGroupWallet(
        groupId: string,
        wallet: Address
    ): Promise<IdentityGroupSelect | null> {
        const [result] = await db
            .update(identityGroupsTable)
            .set({ walletAddress: wallet, updatedAt: new Date() })
            .where(eq(identityGroupsTable.id, groupId))
            .returning();
        return result ?? null;
    }

    async addNode(params: {
        groupId: string;
        type: IdentityType;
        value: string;
        merchantId?: string;
    }): Promise<IdentityNodeSelect> {
        const [result] = await db
            .insert(identityNodesTable)
            .values({
                groupId: params.groupId,
                identityType: params.type,
                identityValue: params.value,
                merchantId: params.merchantId,
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
