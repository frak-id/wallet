import type { AmbassadorPageOverview } from "app/utils/ambassadorPage";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AmbassadorPageActions } from "../../hooks/useAmbassadorPage";
import { MenuCheckbox } from "./MenuCheckbox";

type PublishSectionProps = {
    overview: AmbassadorPageOverview;
    address: string;
    actions: AmbassadorPageActions;
};

/** The draft and hidden states: what the page is, and one button to publish it. */
export function PublishSection({
    overview,
    address,
    actions,
}: PublishSectionProps) {
    const { t } = useTranslation();
    const [addToMenu, setAddToMenu] = useState(true);
    const { proxy, menu } = overview.scopes;
    const willAskPermission = !proxy || (addToMenu && !menu);
    const isHidden = overview.status === "hidden";

    return (
        <s-section heading={t("ambassadorPage.publish.heading")}>
            <s-stack gap="base">
                {isHidden && (
                    <s-paragraph>
                        {t("ambassadorPage.publish.hidden")}
                    </s-paragraph>
                )}
                <s-paragraph>{t("ambassadorPage.publish.pitch")}</s-paragraph>
                <s-unordered-list>
                    <s-list-item>
                        {t("ambassadorPage.publish.bulletLook")}
                    </s-list-item>
                    <s-list-item>
                        {t("ambassadorPage.publish.bulletWidth")}
                    </s-list-item>
                    <s-list-item>
                        {t("ambassadorPage.publish.bulletEdit")}
                    </s-list-item>
                </s-unordered-list>
                <s-paragraph>
                    {t("ambassadorPage.publish.address", { address })}
                </s-paragraph>
                <MenuCheckbox checked={addToMenu} onChange={setAddToMenu} />
                {willAskPermission && (
                    <s-text color="subdued">
                        {t(
                            addToMenu
                                ? "ambassadorPage.publish.permissionWithMenu"
                                : "ambassadorPage.publish.permission"
                        )}
                    </s-text>
                )}
                <s-stack direction="inline">
                    <s-button
                        variant="primary"
                        loading={actions.busyIntent === "publish"}
                        disabled={actions.isBusy}
                        onClick={() => actions.run("publish", { addToMenu })}
                    >
                        {t(
                            isHidden
                                ? "ambassadorPage.publish.actionAgain"
                                : "ambassadorPage.publish.action"
                        )}
                    </s-button>
                </s-stack>
            </s-stack>
        </s-section>
    );
}
