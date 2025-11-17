import { db } from "@backend-infrastructure";
import { eq } from "drizzle-orm";
import {
    archivedInteractionsTable,
    pendingInteractionsTable,
} from "../db/schema";

export class ArchiveRepository {
    /**
     * Archive a pending interaction
     */
    async archiveInteraction(
        interaction: typeof pendingInteractionsTable.$inferSelect,
        reason: "max_retries" | "expired" | "manual"
    ) {
        return db.transaction(async (trx) => {
            // Insert into archive
            await trx.insert(archivedInteractionsTable).values({
                wallet: interaction.wallet,
                productId: interaction.productId,
                typeDenominator: interaction.typeDenominator,
                interactionData: interaction.interactionData,
                signature: interaction.signature ?? undefined,
                finalStatus: interaction.status ?? "pending",
                failureReason: interaction.failureReason ?? undefined,
                totalRetries: interaction.retryCount ?? 0,
                archiveReason: reason,
                originalCreatedAt: interaction.createdAt,
            });

            // Delete from pending
            await trx
                .delete(pendingInteractionsTable)
                .where(eq(pendingInteractionsTable.id, interaction.id));
        });
    }

    /**
     * Archive multiple interactions
     */
    async archiveInteractions(
        interactions: (typeof pendingInteractionsTable.$inferSelect)[],
        reason: "max_retries" | "expired" | "manual"
    ) {
        for (const interaction of interactions) {
            await this.archiveInteraction(interaction, reason);
        }
    }
}
