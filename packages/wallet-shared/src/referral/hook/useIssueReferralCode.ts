import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { referralKey } from "../queryKeys";

type IssueInput = {
    /** Optional 6-char preferred code (typically picked from `suggest`). */
    code?: string;
};

type IssueResult = {
    code: string;
    createdAt: string;
};

type UseIssueReferralCodeProps = {
    mutations?: MutationOptions<IssueResult, Error, IssueInput>;
};

/**
 * Issue a referral code for the authenticated wallet. Without a preferred
 * code, the backend generates one. Backend rejects with 400 (invalid) /
 * 409 (already active or unavailable code).
 */
export function useIssueReferralCode({
    mutations,
}: UseIssueReferralCodeProps = {}) {
    return useMutation({
        ...mutations,
        mutationKey: referralKey.issue,
        mutationFn: async (input: IssueInput) => {
            const { data, error } =
                await authenticatedWalletApi.referral.code.issue.post(
                    input.code ? { code: input.code } : {}
                );
            if (error) throw error;
            return data;
        },
    });
}
