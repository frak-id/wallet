import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { referralKey } from "../queryKeys";

type SuggestInput = {
    /** 3-4 char stem the user typed. */
    stem: string;
    /** Number of suggestions (1-20, default 4 for the picker UI). */
    count?: number;
};

type SuggestResult = {
    suggestions: string[];
};

type UseSuggestReferralCodesProps = {
    mutations?: MutationOptions<SuggestResult, Error, SuggestInput>;
};

/**
 * Suggest 6-char referral codes from a 3-4 char stem. Triggered manually
 * (on "Générer mon code" click) — we don't fan out a request on every
 * keystroke. Exposed as a mutation since callers want imperative control.
 */
export function useSuggestReferralCodes({
    mutations,
}: UseSuggestReferralCodesProps = {}) {
    return useMutation({
        ...mutations,
        mutationKey: referralKey.suggest,
        mutationFn: async ({ stem, count = 4 }: SuggestInput) => {
            const { data, error } =
                await authenticatedWalletApi.referral.code.suggest.get({
                    query: { stem, count },
                });
            if (error) throw error;
            return data;
        },
    });
}
