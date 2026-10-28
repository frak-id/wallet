import { generateCode } from "@backend-utils";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type InstagramLinkCodeSelect,
    instagramLinkCodesTable,
} from "../db/schema";

const MINT_ATTEMPTS = 5;

export class InstagramLinkCodeRepository {
    async findByIdentityGroup(
        identityGroupId: string
    ): Promise<InstagramLinkCodeSelect | null> {
        const [code] = await db
            .select()
            .from(instagramLinkCodesTable)
            .where(eq(instagramLinkCodesTable.identityGroupId, identityGroupId))
            .limit(1);
        return code ?? null;
    }

    /** The group's unused code, minted on first ask: a code already copied keeps working. */
    async getOrCreate(
        identityGroupId: string
    ): Promise<InstagramLinkCodeSelect> {
        for (let attempt = 0; attempt < MINT_ATTEMPTS; attempt++) {
            const [minted] = await db
                .insert(instagramLinkCodesTable)
                .values({ identityGroupId, code: generateCode() })
                .onConflictDoNothing()
                .returning();
            if (minted) return minted;
            // The group's own row, or a code clash: only the first is final.
            const existing = await this.findByIdentityGroup(identityGroupId);
            if (existing) return existing;
        }
        throw new Error(
            `Failed to mint an Instagram link code for ${identityGroupId}`
        );
    }

    async findByCodes(codes: string[]): Promise<InstagramLinkCodeSelect[]> {
        if (codes.length === 0) return [];
        return db
            .select()
            .from(instagramLinkCodesTable)
            .where(inArray(instagramLinkCodesTable.code, codes));
    }

    async deleteById(id: string): Promise<void> {
        await db
            .delete(instagramLinkCodesTable)
            .where(eq(instagramLinkCodesTable.id, id));
    }
}
