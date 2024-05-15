import {setUserReferred} from "@/context/referral/action/userReferred";
import {setUserReferredOnContent} from "@/context/referral/action/userReferredOnContent";
import {referralHistoryAtom} from "@/module/listener/atoms/referralHistory";
import type {WebAuthNWallet} from "@/types/WebAuthN";
import {useAtom} from "jotai";
import {useCallback} from "react";
import type {Hex} from "viem";

/**
 * Small hook used to perform redirection in the paywall context
 */
export function useTriggerReferral() {
    /**
     * Referral history atom
     */
    const [referralHistory, setReferralHistory] = useAtom(referralHistoryAtom);

    /**
     * Trigger the referral
     */
    const triggerReferral = useCallback(
        async (wallet: WebAuthNWallet) => {
            if (!referralHistory) return;

            // Set the user referred
            await setUserReferred({
                user: wallet.address,
                referrer: referralHistory.lastReferrer,
            });

            // Set the user referred on each content
            for (const contentId of Object.keys(referralHistory.contents)) {
                const walletAddress =
                    referralHistory.contents[contentId as Hex];
                await setUserReferredOnContent({
                    user: wallet.address,
                    referrer: walletAddress,
                    contentId: contentId as Hex,
                });
            }

            // Reset referral history
            setReferralHistory({
                contents: {},
                lastReferrer: "0x00",
            });
        },
        [referralHistory, setReferralHistory]
    );

    return {triggerReferral};
}
