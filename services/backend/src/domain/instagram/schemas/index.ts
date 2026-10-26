import { t } from "@backend-utils";
import type { Static } from "elysia";

/** What a wallet sees of a link: the `igsid` is an internal key and never leaves the backend. */
export const InstagramLinkSchema = t.Object({
    username: t.String(),
    /** Whether the account followed @frak_fr at `checkedAt`. */
    follows: t.Boolean(),
    checkedAt: t.Date(),
});
export type InstagramLink = Static<typeof InstagramLinkSchema>;

export const InstagramLinkResponseSchema = t.Object({
    link: t.Union([InstagramLinkSchema, t.Null()]),
});

/** Non-prod only: stands in for what Meta's webhook will report. */
export const MockInstagramLinkBodySchema = t.Object({
    username: t.String({ minLength: 1, maxLength: 32 }),
    follows: t.Boolean(),
});
export type MockInstagramLinkBody = Static<typeof MockInstagramLinkBodySchema>;
