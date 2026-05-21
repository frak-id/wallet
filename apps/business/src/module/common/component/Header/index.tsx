import { Link, useLocation } from "@tanstack/react-router";
import { Download, Plus } from "lucide-react";
import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { ButtonRefresh } from "@/module/common/component/ButtonRefresh";
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
                                title="Demo mode is active. Click to manage settings."
                            >
                                demo
                            </Link>
                        )}
                        <ButtonRefresh />
                        {showExport && (
                            <Button
                                variant="secondary"
                                rightIcon={<Download size={16} />}
                            >
                                Export
                            </Button>
                        )}
                        {showCreateCampaign && <ButtonNewCampaign />}
                        {showAddMerchant && (
                            <AddMerchantSheet
                                trigger={
                                    <Button variant="primary">
                                        <Plus size={16} />
                                        Add merchant
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
