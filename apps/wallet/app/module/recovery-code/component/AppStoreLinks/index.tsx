import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const appStoreUrl = "https://apps.apple.com/app/frak-wallet/id6740261164";

/**
 * App Store and Play Store download links for the install page.
 * Play Store link includes referrer data when merchantId and anonymousId are available.
 */
export function AppStoreLinks({
    merchantId,
    anonymousId,
}: {
    merchantId?: string;
    anonymousId?: string;
}) {
    const { t } = useTranslation();

    const playStoreUrl = useMemo(() => {
        if (!merchantId || !anonymousId) return undefined;
        const referrerData = `merchantId=${merchantId}&anonymousId=${anonymousId}`;
        return `https://play.google.com/store/apps/details?id=id.frak.wallet&referrer=${encodeURIComponent(referrerData)}`;
    }, [merchantId, anonymousId]);

    return (
        <Stack space={"m"}>
            <Box
                as="a"
                href={appStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                display={"flex"}
                alignItems={"center"}
                justifyContent={"center"}
                padding={"m"}
                borderRadius={"full"}
                backgroundColor={"primary"}
                color={"onAction"}
                fontWeight={"semiBold"}
                fontSize={"m"}
                textAlign={"center"}
            >
                {t("installCode.appStore")}
            </Box>
            {playStoreUrl && (
                <Box
                    as="a"
                    href={playStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    display={"flex"}
                    alignItems={"center"}
                    justifyContent={"center"}
                    padding={"m"}
                    borderRadius={"full"}
                    backgroundColor={"muted"}
                    color={"primary"}
                    fontWeight={"semiBold"}
                    fontSize={"m"}
                    textAlign={"center"}
                >
                    {t("installCode.playStore")}
                </Box>
            )}
        </Stack>
    );
}
