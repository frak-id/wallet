import type { Language } from "@frak-labs/core-sdk";
import { type AmbassadorCopy, ambassadorCopy } from "./ambassador";
import { type BannerCopy, bannerCopy } from "./banner";
import { type ButtonShareCopy, buttonShareCopy } from "./buttonShare";
import { type ButtonWalletCopy, buttonWalletCopy } from "./buttonWallet";
import { type CountdownCopy, countdownCopy } from "./countdown";
import { type OpenInAppCopy, openInAppCopy } from "./openInApp";
import { type PostPurchaseCopy, postPurchaseCopy } from "./postPurchase";
import { type RewardReminderCopy, rewardReminderCopy } from "./rewardReminder";
import { type RewardWordingCopy, rewardWordingCopy } from "./rewardWording";

type ComponentCopy = {
    rewardWording: RewardWordingCopy;
    buttonShare: ButtonShareCopy;
    postPurchase: PostPurchaseCopy;
    openInApp: OpenInAppCopy;
    buttonWallet: ButtonWalletCopy;
    banner: BannerCopy;
    rewardReminder: RewardReminderCopy & CountdownCopy;
    ambassador: AmbassadorCopy;
};

const forLanguage = (lang: Language): ComponentCopy => ({
    rewardWording: rewardWordingCopy[lang],
    buttonShare: buttonShareCopy[lang],
    postPurchase: postPurchaseCopy[lang],
    openInApp: openInAppCopy[lang],
    buttonWallet: buttonWalletCopy[lang],
    banner: bannerCopy[lang],
    rewardReminder: { ...rewardReminderCopy[lang], ...countdownCopy[lang] },
    ambassador: ambassadorCopy[lang],
});

/**
 * Every component's built-in copy in one table, for the npm export
 * `@frak-labs/components/i18n/defaults`. Components import their own
 * `src/i18n/<block>.ts` instead, so a CDN chunk carries only its strings.
 * Last-resort fallback, after an HTML attribute or backend config override.
 */
export const componentDefaults: Record<Language, ComponentCopy> = {
    en: forLanguage("en"),
    fr: forLanguage("fr"),
};
