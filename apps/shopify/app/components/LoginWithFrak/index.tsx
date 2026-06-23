import { useOpenSso } from "@frak-labs/react-sdk";
import type { loader as rootLoader } from "app/routes/app";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";

/**
 * Button that triggers the Frak SSO flow so the merchant can connect their
 * Frak wallet. Used at the point of need (product registration, bank actions)
 * instead of gating the whole admin app behind a wallet connection.
 */
export function LoginWithFrak({
    variant = "primary",
    disabled = false,
}: {
    variant?: "primary" | "secondary";
    disabled?: boolean;
}) {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const { mutate: openSso } = useOpenSso();
    const { t } = useTranslation();

    const login = useCallback(() => {
        openSso({
            metadata: {
                homepageLink: rootData?.shop?.url,
                logoUrl: rootData?.shopifyLogoUrl,
            },
        });
    }, [openSso, rootData?.shop?.url, rootData?.shopifyLogoUrl]);

    return (
        <s-button variant={variant} onClick={login} disabled={disabled}>
            {t("login.withFrak")}
        </s-button>
    );
}
