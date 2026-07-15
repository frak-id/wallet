import { t } from "@backend-utils";
import { getSchemaValidator } from "elysia";
import { describe, expect, it } from "vitest";
import { BusinessTokenDto } from "../../../src/domain/auth/models/BusinessSessionDto";
import { BusinessInvitationTokenDto } from "../../../src/domain/business-auth/models/BusinessInvitationTokenDto";

/**
 * `businessInvitation` shares `JWT_BUSINESS_SECRET` with the legacy
 * `business` session context (`resolveBusinessAuth.ts`) — `jose` itself is
 * globally mocked in this test suite (`test/mock/common.ts`), so signature
 * verification can't be exercised end-to-end here. What actually gates
 * cross-acceptance once the signature checks out is the schema shape check
 * `buildJwtContext.verify` runs via `getSchemaValidator` (jwt.ts:195-207) —
 * that's the unit this test pins: the `typ` literal on
 * `BusinessInvitationTokenDto` and the required `wallet` on
 * `BusinessTokenDto` make the two shapes mutually exclusive.
 */
describe("business session vs. business-invitation JWT — schema cross-acceptance", () => {
    // Mirrors buildJwtContext's validator: schema + the JWT-spec claims as
    // additional accepted properties.
    const jwtClaims = t.Object({
        iss: t.Optional(t.String()),
        sub: t.Optional(t.String()),
        aud: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        jti: t.Optional(t.String()),
        nbf: t.Optional(t.Number()),
        exp: t.Optional(t.Number()),
        iat: t.Optional(t.Number()),
    });

    const businessValidator = getSchemaValidator(BusinessTokenDto, {
        modules: t.Module({}),
        validators: [jwtClaims],
    });
    const invitationValidator = getSchemaValidator(BusinessInvitationTokenDto, {
        modules: t.Module({}),
        validators: [jwtClaims],
    });

    const invitationPayload = {
        typ: "business-invitation" as const,
        sub: "00000000-0000-0000-0000-000000000001",
        merchantId: "00000000-0000-0000-0000-000000000002",
        email: "invitee@example.com",
        invitedBy: null,
    };

    const legacySessionPayload = {
        wallet: "0x1111111111111111111111111111111111111111",
    };

    it("accepts an invitation payload against the invitation schema", () => {
        expect(invitationValidator.Check(invitationPayload)).toBe(true);
    });

    it("rejects a legacy business session payload against the invitation schema", () => {
        expect(invitationValidator.Check(legacySessionPayload)).toBe(false);
    });

    it("accepts a legacy business session payload against the business schema", () => {
        expect(businessValidator.Check(legacySessionPayload)).toBe(true);
    });

    it("rejects an invitation payload against the business schema (reverse direction)", () => {
        expect(businessValidator.Check(invitationPayload)).toBe(false);
    });
});
