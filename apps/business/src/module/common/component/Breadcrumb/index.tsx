import { Box } from "@frak-labs/design-system/components/Box";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export function Breadcrumb({ current }: { current: string }) {
    const { t } = useTranslation();
    return (
        <Box
            as="span"
            display="flex"
            alignItems="center"
            gap="xs"
            color="tertiary"
        >
            <Link to="/dashboard">{t("shell.nav.dashboard")}</Link>
            <ChevronRight size={18} />
            {current}
        </Box>
    );
}
