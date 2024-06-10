import { contentIds } from "@/context/blockchain/contentIds";
import { pushInteraction } from "@/context/interaction/action/pushInteraction";
import { PressInteraction } from "@/context/interaction/utils/pressInteraction";
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
            await pushInteraction({
                wallet: wallet.address,
                contentId: contentIds.frak,
                interaction: PressInteraction.buildReferred({
                    referrer: FRAK_WALLET_GOVERNANCE,
                }),
            }),
        []
    );

    /**
     * Referral from the last referred user
     */
    const referralFromUser = useCallback(
        async (wallet: WebAuthNWallet) => {
            // Set the user referred
            await pushInteraction({
                wallet: wallet.address,
                contentId: contentIds.frak,
                interaction: PressInteraction.buildReferred({
                    referrer: referralHistory.lastReferrer,
                }),
            });

            // Set the user referred on each content
            for (const contentId of Object.keys(referralHistory.contents)) {
                const walletAddress =
                    referralHistory.contents[contentId as Hex];
                await pushInteraction({
                    wallet: wallet.address,
                    contentId: BigInt(contentId),
                    interaction: PressInteraction.buildReferred({
                        referrer: walletAddress,
                    }),
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
