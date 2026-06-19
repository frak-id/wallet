import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Shape returned when an email is already owned by a *different* identity group
 * — the conflicting wallet + its active-chain credentials the merge UI consumes.
 * Declared once and reused by every route that surfaces a conflict (email
 * availability, verification send + verify) so they stay identical.
 */
export const conflictTargetFields = {
    authenticatorIds: t.Array(t.String()),
    wallet: t.Optional(t.Address()),
};
export const ConflictTargetSchema = t.Object(conflictTargetFields);
export type ConflictTarget = Static<typeof ConflictTargetSchema>;

export const EmailStatusResponseSchema = t.Union([
    t.Object({ used: t.Literal(false) }),
    t.Object({
        used: t.Literal(true),
        ...conflictTargetFields,
        /**
         * @deprecated Backward-compat for old wallet apps shipped before the
         * merge release. They read a single `authenticatorId` to drive a
         * targeted `login()`; new clients read `authenticatorIds`. Kept
         * optional so an un-updated app keeps its "email already used → log in"
         * path working during rollout. Remove once those apps age out.
         */
        authenticatorId: t.Optional(t.String()),
    }),
]);
export type EmailStatusResponse = Static<typeof EmailStatusResponseSchema>;

/**
 * Current authenticator's email status. Returned by the wallet "do I have an
 * email on file" check used to decide whether to offer the post-auth
 * "add my email" flow, and now whether to offer verification / show a pending
 * rotation. `email` stays the primary field existing clients read; `verified`,
 * `verifiedAt` and `pendingEmail` are additive.
 */
export const MyEmailResponseSchema = t.Object({
    email: t.Union([t.String(), t.Null()]),
    verified: t.Boolean(),
    verifiedAt: t.Union([t.String(), t.Null()]),
    pendingEmail: t.Optional(t.Union([t.String(), t.Null()])),
});
export type MyEmailResponse = Static<typeof MyEmailResponseSchema>;
