import { JwtContext, log, viemClient } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { keccak256, toHex } from "viem";
import { verifyMessage } from "viem/actions";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { BusinessAuthResponseDto } from "../../../domain/auth";

export const authRoutes = new Elysia({ prefix: "/auth" }).post(
    "/login",
    async ({ body: { message, signature }, request }) => {
        // Parse the siwe message
        const siweMessage = parseSiweMessage(message);
        if (!siweMessage?.address) {
            return status(400, "Invalid SIWE message");
        }

        // Ensure the siwe message is valid
        const host = request.headers.get("host") ?? "";
        const isValid = validateSiweMessage({
            message: siweMessage,
            domain: "localhost:3022",
        });
        if (!isValid) {
            log.error({ siweMessage, host }, "Invalid SIWE message");
            return status(400, "Invalid SIWE message");
        }

        // Ensure the siwe message matches the given signature
        const isValidSignature = await verifyMessage(viemClient, {
            message,
            signature,
            address: siweMessage.address,
        });
        console.log("isValidSignature:", {
            isValidSignature,
            signature,
            siweMessage,
        });
        if (!isValidSignature) {
            log.error(
                {
                    signature,
                    message,
                    formattedHash: keccak256(toHex(message)),
                },
                "Invalid SIWE signature"
            );
            return status(400, "Invalid signature");
        }

        // Generate JWT token
        const token = await JwtContext.business.sign({
            wallet: siweMessage.address,
            siwe: {
                message,
                signature,
            },
            sub: siweMessage.address,
            iat: Date.now(),
        });

        // Calculate expiration time (1 week from now)
        const expiresAt = Date.now() + 60 * 60 * 24 * 7 * 1000;

        return {
            token,
            wallet: siweMessage.address,
            expiresAt,
        };
    },
    {
        body: t.Object({
            message: t.String(),
            signature: t.Hex(),
        }),
        response: {
            200: BusinessAuthResponseDto,
            400: t.String(),
        },
    }
);
