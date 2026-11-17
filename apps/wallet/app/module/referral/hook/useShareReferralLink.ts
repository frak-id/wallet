import {
    canShareNatively,
    recordError,
    type SharingSource,
    shareNatively,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { useCurrentGame } from "@/module/game/hook/useCurrentGame";
import { prizeOf } from "@/module/game/utils/gamePrize";
import { referralLink } from "../utils/referralLink";

export type ReferralShareOutcome = "shared" | "copied" | "dismissed";

/**
 * Shares a referral code's link through the OS sheet, or hands text and link to
 * `copy` where there is none. While a game is open the text invites to it.
 */
export function useShareReferralLink(
    code: string | undefined,
    source: SharingSource
) {
    const { t, i18n } = useTranslation();
    const game = useCurrentGame().data?.game;
    const link = code ? referralLink(code) : undefined;

    const share = async (
        copy: (value: string) => void
    ): Promise<ReferralShareOutcome> => {
        if (!(code && link)) return "dismissed";
        const text = game
            ? t("wallet.referral.share.gameShareText", {
                  code,
                  prize: prizeOf(game, i18n.language),
              })
            : t("wallet.referral.share.shareText", { code });
        if (!canShareNatively()) {
            copy(`${text}\n${link}`);
            trackEvent("sharing_link_copied", { source, link });
            return "copied";
        }
        trackEvent("sharing_link_started", { source, link });
        // No `title`: with one, macOS Safari shares two items ("2 Images").
        const shared = await shareNatively({ text, url: link }).catch(
            (err: unknown) => {
                recordError(err, {
                    source: "sharing",
                    context: { sharing_source: source },
                });
                return false;
            }
        );
        if (!shared) return "dismissed";
        trackEvent("sharing_link_shared", { source, link });
        return "shared";
    };

    return { link, share };
}
