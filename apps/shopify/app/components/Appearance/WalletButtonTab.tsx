import type { loader as rootLoader } from "app/routes/app";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import screenWalletButton from "../../assets/wallet-button.png";
import { Activated } from "../Activated";
import { Instructions } from "../Instructions";
import { ExternalLink } from "../ui/ExternalLink";

interface WalletButtonTabProps {
    themeWalletButton?: string | null;
}

export function WalletButtonTab({ themeWalletButton }: WalletButtonTabProps) {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const editorUrl = `https://${rootData?.shop.myshopifyDomain}/admin/themes/current/editor`;
    const { t } = useTranslation();

    return (
        <s-section>
            <s-box>
                {themeWalletButton && (
                    <>
                        <Activated
                            text={t("appearance.walletButton.activated")}
                        />
                        <s-box paddingBlockStart="small">
                            <ExternalLink
                                href={`${editorUrl}?context=apps&appEmbed=${themeWalletButton}%2Fwallet_button`}
                            >
                                {t("appearance.walletButton.link")}
                            </ExternalLink>
                        </s-box>
                    </>
                )}
                {!themeWalletButton && <WalletButtonNotActivated />}
            </s-box>
        </s-section>
    );
}

function WalletButtonNotActivated() {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const editorUrl = `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current/editor`;

    return (
        <Instructions
            badgeText={t("appearance.walletButton.notActivated")}
            todoText={t("appearance.walletButton.todo")}
            image={screenWalletButton}
        >
            <ExternalLink href={`${editorUrl}?context=apps`}>
                {t("appearance.walletButton.link")}
            </ExternalLink>
        </Instructions>
    );
}
