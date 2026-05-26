import { Link, useLocation } from "@tanstack/react-router";
import { Download, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { AddMerchantSheet } from "@/module/dashboard/component/AddMerchantSheet";
import { ButtonSendPush } from "@/module/members/component/ButtonSendPush";
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

const CAMPAIGNS_PATH = /^\/m\/[^/]+\/campaigns(\/|$)/;
const DASHBOARD_PATH = /^\/m\/[^/]+\/dashboard$/;
const MERCHANT_PATH = /^\/m\/[^/]+\/merchant(\/|$)/;
const MEMBERS_PATH = /^\/m\/[^/]+\/members$/;

// TODO: drop the legacy `/campaigns`, `/dashboard`, `/merchant/` branches
// once all entry points are merchant-scoped and the legacy redirect
// routes (`_restricted/{campaigns,dashboard,merchant}.tsx`) are removed.
export function Header() {
    const { t } = useTranslation();
    const isDemoMode = useIsDemoMode();
    const { pathname } = useLocation();
    const showCreateCampaign =
        CAMPAIGNS_PATH.test(pathname) || pathname.startsWith("/campaigns");
    const showAddMerchant =
        DASHBOARD_PATH.test(pathname) ||
        pathname === "/dashboard" ||
        MERCHANT_PATH.test(pathname) ||
        pathname.startsWith("/merchant/");
    const showExport =
        CAMPAIGNS_PATH.test(pathname) || pathname.startsWith("/campaigns");
    const showSendPush = MEMBERS_PATH.test(pathname);

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
                        {showSendPush && <ButtonSendPush />}
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
