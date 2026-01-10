import { db } from "@backend-infrastructure";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Address } from "viem";
import { merchantOwnershipTransfersTable } from "../db/schema";

type OwnershipTransferSelect =
    typeof merchantOwnershipTransfersTable.$inferSelect;

export type { OwnershipTransferSelect };

const TRANSFER_EXPIRY_DAYS = 7;

export class MerchantOwnershipTransferRepository {
    async findByMerchant(
        merchantId: string
    ): Promise<OwnershipTransferSelect | null> {
        const result = await db.query.merchantOwnershipTransfersTable.findFirst(
            {
                where: eq(
                    merchantOwnershipTransfersTable.merchantId,
                    merchantId
                ),
            }
        );
        return result ?? null;
    }

    async findActiveByMerchant(
        merchantId: string
    ): Promise<OwnershipTransferSelect | null> {
        const result = await db.query.merchantOwnershipTransfersTable.findFirst(
            {
                where: and(
                    eq(merchantOwnershipTransfersTable.merchantId, merchantId),
                    gt(merchantOwnershipTransfersTable.expiresAt, new Date())
                ),
            }
        );
        return result ?? null;
    }

    async findPendingForWallet(
        wallet: Address
    ): Promise<OwnershipTransferSelect[]> {
        return db.query.merchantOwnershipTransfersTable.findMany({
            where: and(
                eq(merchantOwnershipTransfersTable.toWallet, wallet),
                gt(merchantOwnershipTransfersTable.expiresAt, new Date())
            ),
        });
    }

    async create(params: {
        merchantId: string;
        fromWallet: Address;
        toWallet: Address;
    }): Promise<OwnershipTransferSelect> {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + TRANSFER_EXPIRY_DAYS);

        const [result] = await db
            .insert(merchantOwnershipTransfersTable)
            .values({
                merchantId: params.merchantId,
                fromWallet: params.fromWallet,
                toWallet: params.toWallet,
                expiresAt,
            })
            .onConflictDoUpdate({
                target: merchantOwnershipTransfersTable.merchantId,
                set: {
                    fromWallet: params.fromWallet,
                    toWallet: params.toWallet,
                    initiatedAt: new Date(),
                    expiresAt,
                },
            })
            .returning();

        if (!result) {
            throw new Error("Failed to create ownership transfer");
        }
        return result;
    }

    async delete(merchantId: string): Promise<boolean> {
        const result = await db
            .delete(merchantOwnershipTransfersTable)
            .where(eq(merchantOwnershipTransfersTable.merchantId, merchantId));
        return result.count > 0;
    }

    async deleteExpired(): Promise<number> {
        const result = await db
            .delete(merchantOwnershipTransfersTable)
            .where(lt(merchantOwnershipTransfersTable.expiresAt, new Date()));
        return result.count;
    }
}
