import { t } from "@backend-utils";
import type { Static } from "elysia";

/** What a wallet sees of a certified link: the `igsid` is an internal key and never leaves the backend. */
export const InstagramLinkSchema = t.Object({
    username: t.String(),
    /** Whether the account followed @frak_fr at `checkedAt`. */
    follows: t.Boolean(),
    checkedAt: t.Date(),
});
export type InstagramLink = Static<typeof InstagramLinkSchema>;

/** A typed handle: counts in the draw, checked only if the player is drawn. */
export const InstagramDeclarationSchema = t.Object({
    username: t.String(),
    declaredAt: t.Date(),
});
export type InstagramDeclaration = Static<typeof InstagramDeclarationSchema>;

export const InstagramLevelSchema = t.Union([
    t.Literal("certified"),
    t.Literal("declared"),
    t.Literal("none"),
]);
export type InstagramLevel = Static<typeof InstagramLevelSchema>;

export const InstagramStatusSchema = t.Object({
    link: t.Union([InstagramLinkSchema, t.Null()]),
    declaration: t.Union([InstagramDeclarationSchema, t.Null()]),
});
export type InstagramStatus = Static<typeof InstagramStatusSchema>;

export const DeclareInstagramBodySchema = t.Object({
    username: t.String({ minLength: 1, maxLength: 32 }),
});

export const InstagramLinkCodeResponseSchema = t.Object({
    code: t.String(),
});
