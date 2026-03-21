import { beforeEach, describe, expect, it } from "vitest";
import { rewardsRoutes } from "../../../src/api/user/wallet/rewards";
import {
    JwtContextMock,
    rewardHistoryOrchestratorMocks,
} from "../../mock/common";

describe("Wallet Rewards Routes API", () => {
    const mockWalletAddress = "0x1234567890123456789012345678901234567890";
    const validSdkAuthToken = "valid-sdk-jwt-token";

    beforeEach(() => {
        JwtContextMock.wallet.verify.mockClear();
        JwtContextMock.walletSdk.verify.mockClear();
        rewardHistoryOrchestratorMocks.getHistory.mockClear();
    });

    describe("GET /rewards/history", () => {
        it("should return rewards history when authenticated with SDK token only", async () => {
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                scopes: ["interaction"],
            } as never);

            const response = await rewardsRoutes.handle(
                new Request("http://localhost/rewards/history", {
                    headers: {
                        "x-wallet-sdk-auth": validSdkAuthToken,
                    },
                })
            );

            expect(response.status).toBe(200);
            expect(JwtContextMock.wallet.verify).not.toHaveBeenCalled();
            expect(JwtContextMock.walletSdk.verify).toHaveBeenCalledWith(
                validSdkAuthToken
            );

            const data = await response.json();
            expect(data).toEqual({ items: [], totalCount: 0 });
        });
    });
});
