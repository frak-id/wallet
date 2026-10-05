import type { AmbassadorPageActions } from "app/hooks/useAmbassadorPage";
import type { AmbassadorPageOverview } from "app/utils/ambassadorPage";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalButton } from "../ui/ExternalLink";
import { MenuCheckbox } from "./MenuCheckbox";

type SwitchSectionProps = {
    overview: AmbassadorPageOverview;
    actions: AmbassadorPageActions;
};

/** The `oldPage` state: one button to move a `/pages/` page to the full-width page. */
export function SwitchSection({ overview, actions }: SwitchSectionProps) {
    const { t } = useTranslation();
    const [addToMenu, setAddToMenu] = useState(true);
    const { proxy, menu, pages } = overview.scopes;

    return (
        <s-section heading={t("ambassadorPage.switch.heading")}>
            <s-stack gap="base">
                <s-paragraph>{t("ambassadorPage.switch.body")}</s-paragraph>
                <MenuCheckbox checked={addToMenu} onChange={setAddToMenu} />
                {!(proxy && menu && pages) && (
                    <s-text color="subdued">
                        {t("ambassadorPage.switch.permission")}
                    </s-text>
                )}
                <s-stack direction="inline" gap="base">
                    <s-button
                        variant="primary"
                        loading={actions.busyIntent === "switch"}
                        disabled={actions.isBusy}
                        onClick={() => actions.run("switch", { addToMenu })}
                    >
                        {t("ambassadorPage.switch.action")}
                    </s-button>
                    {overview.oldPageUrl && (
                        <ExternalButton
                            icon="external"
                            href={overview.oldPageUrl}
                        >
                            {t("ambassadorPage.switch.seeCurrent")}
                        </ExternalButton>
                    )}
                </s-stack>
            </s-stack>
        </s-section>
    );
}
