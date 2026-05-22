import { Box } from "@frak-labs/design-system/components/Box";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOptionalActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";

export function Breadcrumb({ current }: { current: string }) {
    const { t } = useTranslation();
    const merchantId = useOptionalActiveMerchantId();
    return (
        <Box
            as="span"
            display="flex"
            alignItems="center"
            gap="xs"
            color="tertiary"
        >
            {merchantId ? (
                <Link to="/m/$merchantId/dashboard" params={{ merchantId }}>
                    {t("shell.nav.dashboard")}
                </Link>
            ) : (
                <Link to="/dashboard">{t("shell.nav.dashboard")}</Link>
            )}
            <ChevronRight size={18} />
            {current}
        </Box>
    );
}
