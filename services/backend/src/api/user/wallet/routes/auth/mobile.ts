import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AuthContext } from "../../../../../domain/auth";
import {
    ExchangeMobileAuthCodeRequestDto,
    ExchangeMobileAuthCodeResponseDto,
    GenerateMobileAuthCodeRequestDto,
    GenerateMobileAuthCodeResponseDto,
} from "../../../../../domain/auth/models/MobileAuthCodeDto";

export const mobileAuthRoutes = new Elysia({ prefix: "/mobile" })
    .use(sessionContext)
    .post(
        "/code",
        async ({ walletSession, body: { returnOrigin } }) => {
            const result =
                await AuthContext.services.mobileAuthCode.generateAuthCode({
                    walletAddress: walletSession.address,
                    returnOrigin,
                });
            return result;
        },
        {
            withWalletAuthent: true,
            body: GenerateMobileAuthCodeRequestDto,
            response: {
                401: t.String(),
                200: GenerateMobileAuthCodeResponseDto,
            },
        }
    )
    .post(
        "/exchange",
        async ({ body: { authCode }, request }) => {
            const requestOrigin = request.headers.get("origin") ?? undefined;

            const result =
                await AuthContext.services.mobileAuthCode.exchangeAuthCode({
                    authCode,
                    requestOrigin,
                });

            if (!result) {
                return status(401, "Invalid or expired auth code");
            }

            return result;
        },
        {
            body: ExchangeMobileAuthCodeRequestDto,
            response: {
                401: t.String(),
                200: ExchangeMobileAuthCodeResponseDto,
            },
        }
    );
