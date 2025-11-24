import type {
    GetMembersCountResponseDto,
    GetMembersRequestDto,
    GetMembersResponseDto,
} from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/client/server";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/context/auth/authMiddleware";
import {
    getProductMembersMock,
    getProductsMembersCountMock,
} from "@/context/members/action/mock";

export type GetMembersParam = Omit<
    GetMembersRequestDto,
    "noData" | "onlyAddress"
>;

/**
 * Fetch the members of a product
 * @param params
 */
export const getProductMembers = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator((input: GetMembersParam) => input)
    .handler(async ({ context, data }): Promise<GetMembersResponseDto> => {
        const { wallet, isDemoMode } = context;

        // Check if demo mode is active
        if (isDemoMode) {
            return getProductMembersMock(data);
        }

        try {
            if (!wallet) {
                throw new Error("No active session");
            }

            return await indexerApi
                .post(`members/${wallet}`, {
                    json: data,
                })
                .json<GetMembersResponseDto>();
        } catch (e) {
            console.warn("Failed to fetch members", e);
            return {
                totalResult: 0,
                members: [],
            };
        }
    });

/**
 * Count the number of mumbers for a product matching the given criteria
 * @param params
 */
export const getProductsMembersCount = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator(
        (input: Omit<GetMembersParam, "limit" | "offset" | "sort">) => input
    )
    .handler(async ({ context, data }): Promise<number> => {
        const { wallet, isDemoMode } = context;

        // Check if demo mode is active
        if (isDemoMode) {
            return getProductsMembersCountMock(data);
        }

        try {
            if (!wallet) {
                throw new Error("No active session");
            }

            const result = await indexerApi
                .post(`members/${wallet}`, {
                    json: { ...data, noData: true },
                })
                .json<GetMembersCountResponseDto>();
            return result.totalResult;
        } catch (e) {
            console.warn("Failed to fetch members count", e);
            return 0;
        }
    });
