import type { AmbassadorPageActions } from "app/hooks/useAmbassadorPage";
import type { AmbassadorPageOverview } from "app/utils/ambassadorPage";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ExternalButton } from "../ui/ExternalLink";

type LiveSectionsProps = {
    overview: AmbassadorPageOverview;
    address: string;
    customizeUrl: string | null;
    actions: AmbassadorPageActions;
};

/** The live state: where the page is, how customers reach it, and how to edit or hide it. */
export function LiveSections({
    overview,
    address,
    customizeUrl,
    actions,
}: LiveSectionsProps) {
    const { t } = useTranslation();

    return (
        <>
            <s-section accessibilityLabel={t("ambassadorPage.live.heading")}>
                <s-stack gap="base">
                    <s-stack direction="inline" gap="small" alignItems="center">
                        <s-heading>
                            {t("ambassadorPage.live.heading")}
                        </s-heading>
                        <s-badge tone="success">
                            {t("ambassadorPage.live.badge")}
                        </s-badge>
                    </s-stack>
                    <s-text>{address}</s-text>
                    <s-stack direction="inline" gap="base">
                        <ExternalButton
                            variant="primary"
                            icon="external"
                            href={overview.url}
                        >
                            {t("ambassadorPage.live.see")}
                        </ExternalButton>
                        <CopyAddressButton url={overview.url} />
                    </s-stack>
                    <MenuRow overview={overview} actions={actions} />
                </s-stack>
            </s-section>
            {customizeUrl && (
                <s-section heading={t("ambassadorPage.customize.heading")}>
                    <s-stack gap="base">
                        <s-paragraph>
                            {t("ambassadorPage.customize.body")}
                        </s-paragraph>
                        <s-stack direction="inline">
                            <ExternalButton icon="external" href={customizeUrl}>
                                {t("ambassadorPage.customize.action")}
                            </ExternalButton>
                        </s-stack>
                    </s-stack>
                </s-section>
            )}
            <HideSection actions={actions} />
        </>
    );
}

function CopyAddressButton({ url }: { url: string }) {
    const { t } = useTranslation();

    const copy = () => {
        const failed = () =>
            shopify.toast.show(t("ambassadorPage.live.copyFailed"), {
                isError: true,
            });
        if (!navigator.clipboard?.writeText) {
            failed();
            return;
        }
        navigator.clipboard
            .writeText(url)
            .then(
                () => shopify.toast.show(t("ambassadorPage.live.copied")),
                failed
            );
    };

    return <s-button onClick={copy}>{t("ambassadorPage.live.copy")}</s-button>;
}

function MenuRow({
    overview,
    actions,
}: {
    overview: Pick<AmbassadorPageOverview, "menu" | "scopes">;
    actions: AmbassadorPageActions;
}) {
    const { t } = useTranslation();
    const { state } = overview.menu;

    if (state === "added") {
        return <s-text>{t("ambassadorPage.menu.added")}</s-text>;
    }
    return (
        <s-stack gap="small">
            <s-stack direction="inline" gap="base" alignItems="center">
                <s-text>
                    {t(
                        state === "missing"
                            ? "ambassadorPage.menu.missing"
                            : "ambassadorPage.menu.none"
                    )}
                </s-text>
                <s-button
                    loading={actions.busyIntent === "addToMenu"}
                    disabled={actions.isBusy}
                    onClick={() =>
                        actions.run("addToMenu", { addToMenu: true })
                    }
                >
                    {t(
                        state === "missing"
                            ? "ambassadorPage.menu.addBack"
                            : "ambassadorPage.menu.add"
                    )}
                </s-button>
            </s-stack>
            {!overview.scopes.menu && (
                <s-text color="subdued">
                    {t("ambassadorPage.menu.permission")}
                </s-text>
            )}
        </s-stack>
    );
}

function HideSection({ actions }: { actions: AmbassadorPageActions }) {
    const { t } = useTranslation();
    const modalId = useId();

    return (
        <s-section heading={t("ambassadorPage.hide.heading")}>
            <s-stack gap="base">
                <s-paragraph>{t("ambassadorPage.hide.intro")}</s-paragraph>
                <s-stack direction="inline">
                    <s-button
                        tone="critical"
                        loading={actions.busyIntent === "hide"}
                        disabled={actions.isBusy}
                        command="--show"
                        commandFor={modalId}
                    >
                        {t("ambassadorPage.hide.action")}
                    </s-button>
                </s-stack>
            </s-stack>
            <s-modal
                id={modalId}
                heading={t("ambassadorPage.hide.confirmHeading")}
            >
                <s-paragraph>{t("ambassadorPage.hide.body")}</s-paragraph>
                <s-button
                    slot="primary-action"
                    variant="primary"
                    tone="critical"
                    command="--hide"
                    commandFor={modalId}
                    onClick={() => actions.run("hide")}
                >
                    {t("ambassadorPage.hide.action")}
                </s-button>
                <s-button
                    slot="secondary-actions"
                    command="--hide"
                    commandFor={modalId}
                >
                    {t("ambassadorPage.hide.cancel")}
                </s-button>
            </s-modal>
        </s-section>
    );
}
