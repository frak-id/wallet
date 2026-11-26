import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCapabilities } from "@/module/common/hook/useCapabilities";
import type { TourId } from "@/stores/onboardingTourStore";

export type TourStep = {
    id: string;
    /** Value of the `data-tour` attribute to point at. Centered when absent or hidden. */
    target?: string;
    side?: "top" | "right" | "bottom" | "left";
    title: string;
    body: string;
};

const STORE_PREFIX = "(?:/m/[^/]+)?";

const PAGE_TOURS: ReadonlyArray<readonly [RegExp, TourId | null]> = [
    [/^\/internal(\/|$)/, null],
    [/^\/merchant\/new$/, "storeWizard"],
    [new RegExp(`^${STORE_PREFIX}/campaigns/draft(/|$)`), "campaignWizard"],
    [new RegExp(`^${STORE_PREFIX}/campaigns$`), "campaignsOverview"],
    [new RegExp(`^${STORE_PREFIX}/campaigns/.+`), "campaignsList"],
    [new RegExp(`^${STORE_PREFIX}/(dashboard|merchant/funding)$`), "stores"],
    [new RegExp(`^${STORE_PREFIX}/members$`), "members"],
    [new RegExp(`^${STORE_PREFIX}/push$`), "push"],
    [new RegExp(`^${STORE_PREFIX}/push/create$`), "pushCreate"],
    [new RegExp(`^${STORE_PREFIX}/merchant/setup-status$`), "setupStatus"],
    [new RegExp(`^${STORE_PREFIX}/merchant(/.*)?$`), "storeEdit"],
    [/^\/merchant\/[^/]+(\/.*)?$/, "storeEdit"],
    [/^\/settings\/billing$/, "billing"],
    [/^\/settings$/, "settings"],
];

/** The tour that describes a page. `null` means the page has no tour. */
export function resolveTourId(pathname: string): TourId | null {
    const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
    for (const [pattern, tourId] of PAGE_TOURS) {
        if (pattern.test(path)) return tourId;
    }
    return "welcome";
}

/** Pages where the welcome tour may start by itself. Not over a sheet or a wizard. */
export function canAutoStartOn(pathname: string): boolean {
    if (pathname.endsWith("/merchant/funding")) return false;
    const tourId = resolveTourId(pathname);
    return (
        tourId === "stores" ||
        tourId === "campaignsOverview" ||
        tourId === "campaignsList" ||
        tourId === "members"
    );
}

export function useTours(): Record<TourId, TourStep[]> {
    const { t } = useTranslation();
    const { canOnchain } = useCapabilities();

    return useMemo(
        () => ({
            welcome: [
                {
                    id: "intro",
                    title: t("onboarding.welcome.intro.title"),
                    body: t("onboarding.welcome.intro.body"),
                },
                {
                    id: "stores",
                    target: "nav-stores",
                    side: "right",
                    title: t("onboarding.welcome.stores.title"),
                    body: t("onboarding.welcome.stores.body"),
                },
                {
                    id: "budget",
                    target: "store-budget",
                    side: "bottom",
                    title: t("onboarding.welcome.budget.title"),
                    body: t("onboarding.welcome.budget.body"),
                },
                ...(canOnchain
                    ? []
                    : [
                          {
                              id: "linkWallet",
                              title: t("onboarding.welcome.linkWallet.title"),
                              body: t("onboarding.welcome.linkWallet.body"),
                          },
                      ]),
                {
                    id: "payouts",
                    title: t("onboarding.welcome.payouts.title"),
                    body: t("onboarding.welcome.payouts.body"),
                },
                {
                    id: "campaigns",
                    target: "nav-campaigns",
                    side: "right",
                    title: t("onboarding.welcome.campaigns.title"),
                    body: t("onboarding.welcome.campaigns.body"),
                },
                {
                    id: "members",
                    target: "nav-members",
                    side: "right",
                    title: t("onboarding.welcome.members.title"),
                    body: t("onboarding.welcome.members.body"),
                },
                {
                    id: "account",
                    target: "account-menu",
                    side: "bottom",
                    title: t("onboarding.welcome.account.title"),
                    body: t("onboarding.welcome.account.body"),
                },
                {
                    id: "help",
                    target: "page-tour-button",
                    side: "bottom",
                    title: t("onboarding.welcome.help.title"),
                    body: t("onboarding.welcome.help.body"),
                },
            ],
            stores: [
                {
                    id: "overview",
                    title: t("onboarding.stores.overview.title"),
                    body: t("onboarding.stores.overview.body"),
                },
                {
                    id: "budget",
                    target: "store-budget",
                    side: "bottom",
                    title: t("onboarding.stores.budget.title"),
                    body: t("onboarding.stores.budget.body"),
                },
                {
                    id: "edit",
                    target: "store-edit",
                    side: "bottom",
                    title: t("onboarding.stores.edit.title"),
                    body: t("onboarding.stores.edit.body"),
                },
                {
                    id: "add",
                    target: "add-store",
                    side: "bottom",
                    title: t("onboarding.stores.add.title"),
                    body: t("onboarding.stores.add.body"),
                },
            ],
            campaignsOverview: [
                {
                    id: "overview",
                    title: t("onboarding.campaignsOverview.overview.title"),
                    body: t("onboarding.campaignsOverview.overview.body"),
                },
                {
                    id: "journey",
                    title: t("onboarding.campaignsOverview.journey.title"),
                    body: t("onboarding.campaignsOverview.journey.body"),
                },
                {
                    id: "top",
                    title: t("onboarding.campaignsOverview.top.title"),
                    body: t("onboarding.campaignsOverview.top.body"),
                },
                {
                    id: "create",
                    target: "new-campaign",
                    side: "bottom",
                    title: t("onboarding.campaignsOverview.create.title"),
                    body: t("onboarding.campaignsOverview.create.body"),
                },
            ],
            campaignsList: [
                {
                    id: "list",
                    title: t("onboarding.campaignsList.list.title"),
                    body: t("onboarding.campaignsList.list.body"),
                },
                {
                    id: "actions",
                    title: t("onboarding.campaignsList.actions.title"),
                    body: t("onboarding.campaignsList.actions.body"),
                },
                {
                    id: "bulk",
                    title: t("onboarding.campaignsList.bulk.title"),
                    body: t("onboarding.campaignsList.bulk.body"),
                },
                {
                    id: "create",
                    target: "new-campaign",
                    side: "bottom",
                    title: t("onboarding.campaignsList.create.title"),
                    body: t("onboarding.campaignsList.create.body"),
                },
            ],
            campaignWizard: [
                {
                    id: "steps",
                    title: t("onboarding.campaignWizard.steps.title"),
                    body: t("onboarding.campaignWizard.steps.body"),
                },
                {
                    id: "reward",
                    title: t("onboarding.campaignWizard.reward.title"),
                    body: t("onboarding.campaignWizard.reward.body"),
                },
                {
                    id: "publish",
                    title: t("onboarding.campaignWizard.publish.title"),
                    body: t("onboarding.campaignWizard.publish.body"),
                },
            ],
            storeWizard: [
                {
                    id: "details",
                    title: t("onboarding.storeWizard.details.title"),
                    body: t("onboarding.storeWizard.details.body"),
                },
                {
                    id: "confirm",
                    title: t("onboarding.storeWizard.confirm.title"),
                    body: t("onboarding.storeWizard.confirm.body"),
                },
            ],
            members: [
                {
                    id: "list",
                    title: t("onboarding.members.list.title"),
                    body: t("onboarding.members.list.body"),
                },
                {
                    id: "filters",
                    title: t("onboarding.members.filters.title"),
                    body: t("onboarding.members.filters.body"),
                },
                {
                    id: "push",
                    title: t("onboarding.members.push.title"),
                    body: t("onboarding.members.push.body"),
                },
            ],
            push: [
                {
                    id: "history",
                    title: t("onboarding.push.history.title"),
                    body: t("onboarding.push.history.body"),
                },
                {
                    id: "send",
                    title: t("onboarding.push.send.title"),
                    body: t("onboarding.push.send.body"),
                },
            ],
            pushCreate: [
                {
                    id: "content",
                    title: t("onboarding.pushCreate.content.title"),
                    body: t("onboarding.pushCreate.content.body"),
                },
                {
                    id: "audience",
                    title: t("onboarding.pushCreate.audience.title"),
                    body: t("onboarding.pushCreate.audience.body"),
                },
                {
                    id: "schedule",
                    title: t("onboarding.pushCreate.schedule.title"),
                    body: t("onboarding.pushCreate.schedule.body"),
                },
            ],
            storeEdit: [
                {
                    id: "tabs",
                    title: t("onboarding.storeEdit.tabs.title"),
                    body: t("onboarding.storeEdit.tabs.body"),
                },
                {
                    id: "connections",
                    title: t("onboarding.storeEdit.connections.title"),
                    body: t("onboarding.storeEdit.connections.body"),
                },
                {
                    id: "team",
                    title: t("onboarding.storeEdit.team.title"),
                    body: t("onboarding.storeEdit.team.body"),
                },
                {
                    id: "close",
                    title: t("onboarding.storeEdit.close.title"),
                    body: t("onboarding.storeEdit.close.body"),
                },
            ],
            setupStatus: [
                {
                    id: "checklist",
                    title: t("onboarding.setupStatus.checklist.title"),
                    body: t("onboarding.setupStatus.checklist.body"),
                },
            ],
            settings: [
                {
                    id: "preferences",
                    title: t("onboarding.settings.preferences.title"),
                    body: t("onboarding.settings.preferences.body"),
                },
                {
                    id: "security",
                    title: t("onboarding.settings.security.title"),
                    body: t("onboarding.settings.security.body"),
                },
            ],
            billing: [
                {
                    id: "info",
                    title: t("onboarding.billing.info.title"),
                    body: t("onboarding.billing.info.body"),
                },
                {
                    id: "history",
                    title: t("onboarding.billing.history.title"),
                    body: t("onboarding.billing.history.body"),
                },
            ],
        }),
        [t, canOnchain]
    );
}
