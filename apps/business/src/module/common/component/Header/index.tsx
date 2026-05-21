import { Link, useLocation } from "@tanstack/react-router";
import { Download, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { AddMerchantSheet } from "@/module/dashboard/component/AddMerchantSheet";
import { HeaderBreadcrumb } from "./HeaderBreadcrumb";
import {
    actionGroup,
    demoModeBadge,
    header,
    headerInner,
    headerLeft,
    headerRight,
    hideOnMobile,
} from "./header.css";
import { ProfileLink } from "./ProfileLink";

export function Header() {
    const { t } = useTranslation();
    const isDemoMode = useIsDemoMode();
    const { pathname } = useLocation();
    const showCreateCampaign = pathname.startsWith("/campaigns");
    const showAddMerchant =
        pathname === "/dashboard" || pathname.startsWith("/merchant/");
    const showExport = pathname.startsWith("/campaigns");

    return (
        <header className={header}>
            <div className={headerInner}>
                <div className={headerLeft}>
                    <HeaderBreadcrumb />
                </div>
                <div className={headerRight}>
                    <div className={`${actionGroup} ${hideOnMobile}`}>
                        {isDemoMode && (
                            <Link
                                to="/settings"
                                className={demoModeBadge}
                                title={t("shell.header.demoBadgeTitle")}
                            >
                                {t("shell.header.demoBadge")}
                            </Link>
                        )}
                        {showExport && (
                            <Button
                                variant="secondary"
                                rightIcon={<Download size={16} />}
                            >
                                {t("shell.header.export")}
                            </Button>
                        )}
                        {showCreateCampaign && <ButtonNewCampaign />}
                        {showAddMerchant && (
                            <AddMerchantSheet
                                trigger={
                                    <Button variant="primary">
                                        <Plus size={16} />
                                        {t("shell.header.addMerchant")}
                                    </Button>
                                }
                            />
                        )}
                    </div>
                    <ProfileLink />
                </div>
            </div>
        </header>
    );
}
