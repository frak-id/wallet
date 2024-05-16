import { setUserReferred } from "@/context/referral/action/userReferred";
import { setUserReferredOnContent } from "@/context/referral/action/userReferredOnContent";
import { referralHistoryAtom } from "@/module/listener/atoms/referralHistory";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { useAtom } from "jotai";
import { useCallback } from "react";
import type { Hex } from "viem";

/**
 * Wallet governance address
 */
const FRAK_WALLET_GOVERNANCE: Hex =
    "0xB5cbdba1Db3618a68921e7c00e38617c9AfDf220";

/**
 * Hook to trigger the referral
 */
export function useTriggerReferral() {
    /**
     * Referral history atom
     */
    const [referralHistory, setReferralHistory] = useAtom(referralHistoryAtom);

    /**
     * Referral from Frak when the user is not referred
     */
    const referralFromFrak = useCallback(
        async (wallet: WebAuthNWallet) =>
            await setUserReferred({
                user: wallet.address,
                referrer: FRAK_WALLET_GOVERNANCE,
            }),
        []
    );

    /**
     * Referral from the last referred user
     */
    const referralFromUser = useCallback(
        async (wallet: WebAuthNWallet) => {
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
        },
        [referralHistory]
    );

    /**
     * Trigger the referral
     */
    const triggerReferral = useCallback(
        async (wallet: WebAuthNWallet) => {
            const referralMethod = Object.keys(referralHistory.contents).length
                ? referralFromUser
                : referralFromFrak;
            await referralMethod(wallet);
            setReferralHistory({ contents: {}, lastReferrer: "0x00" });
        },
        [
            referralHistory,
            referralFromFrak,
            referralFromUser,
            setReferralHistory,
        ]
    );

    return { triggerReferral };
}
