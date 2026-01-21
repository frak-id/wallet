import { JwtContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AuthContext, BusinessAuthResponseDto } from "../../../domain/auth";

export const authRoutes = new Elysia({ prefix: "/auth" }).post(
    "/login",
    async ({ body: { expectedChallenge, authenticatorResponse } }) => {
        const verificationResult =
            await AuthContext.services.webAuthN.isValidSignature({
                compressedSignature: authenticatorResponse,
                challenge: expectedChallenge,
            });
        if (!verificationResult) {
            return status(404, "Invalid signature");
        }

        const { address } = verificationResult;

        const token = await JwtContext.business.sign({
            wallet: address,
            sub: address,
            iat: Date.now(),
        });

        // Calculate expiration time (1 week from now)
        const expiresAt = Date.now() + 60 * 60 * 24 * 7 * 1000;

        return {
            token,
            wallet: address,
            expiresAt,
        };
    },
    {
        body: t.Object({
            expectedChallenge: t.Hex(),
            authenticatorResponse: t.String(),
        }),
        response: {
            200: BusinessAuthResponseDto,
            404: t.String(),
        },
    }
);
