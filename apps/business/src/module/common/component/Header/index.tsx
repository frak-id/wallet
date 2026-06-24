import { Badge } from "@frak-labs/design-system/components/Badge";
import { Link, useLocation } from "@tanstack/react-router";
import { Download, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { LinkButton } from "@/module/common/component/LinkButton";
import { ButtonSendPush } from "@/module/members/component/ButtonSendPush";
import { AccountMenu } from "./AccountMenu";
import { HeaderBreadcrumb } from "./HeaderBreadcrumb";
import {
    actionGroup,
    demoModeLink,
    header,
    headerInner,
    headerLeft,
    headerRight,
    hideOnMobile,
} from "./header.css";

const CAMPAIGNS_PATH = /^\/m\/[^/]+\/campaigns(\/|$)/;
const DASHBOARD_PATH = /^\/m\/[^/]+\/dashboard$/;
const MERCHANT_PATH = /^\/m\/[^/]+\/merchant(\/|$)/;
const MEMBERS_PATH = /^\/m\/[^/]+\/members$/;
const PUSH_PATH = /^\/m\/[^/]+\/push$/;

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
    const showSendPush =
        MEMBERS_PATH.test(pathname) || PUSH_PATH.test(pathname);

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
                                className={demoModeLink}
                                title={t("shell.header.demoBadgeTitle")}
                            >
                                <Badge variant="info" size="medium">
                                    {t("shell.header.demoBadge")}
                                </Badge>
                            </Link>
                        )}
                        {showExport && (
                            <Button
                                variant="secondary"
                                size="small"
                                rightIcon={<Download size={16} />}
                            >
                                {t("shell.header.export")}
                            </Button>
                        )}
                        {showCreateCampaign && (
                            <ButtonNewCampaign size="small" />
                        )}
                        {showSendPush && <ButtonSendPush size="small" />}
                        {showAddMerchant && (
                            <LinkButton
                                to="/merchant/new"
                                variant="primary"
                                size="small"
                                icon={<Plus size={16} />}
                            >
                                {t("shell.header.addMerchant")}
                            </LinkButton>
                        )}
                    </div>
                    <AccountMenu />
                </div>
            </div>
        </header>
    );
}
