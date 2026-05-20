import { Link, useLocation } from "@tanstack/react-router";
import { Plus, User } from "lucide-react";
import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { ButtonRefresh } from "@/module/common/component/ButtonRefresh";
import { LogoFrak } from "@/module/common/component/LogoFrak";
import { AddMerchantSheet } from "@/module/dashboard/component/AddMerchantSheet";
import {
    demoModeBadge,
    header,
    headerLogo,
    navigationProfile,
    navigationProfileAvatar,
    navigationProfileInfos,
    navigationProfileSeparator,
    navigationTopContainer,
} from "./header.css";

export function Header() {
    const isDemoMode = useIsDemoMode();
    const { pathname } = useLocation();
    const showCreateCampaign = pathname.startsWith("/campaigns");
    const showAddMerchant =
        pathname === "/dashboard" || pathname.startsWith("/merchant/");

    return (
        <div>
            <header className={header}>
                <Link to="/dashboard" className={headerLogo}>
                    <LogoFrak />
                </Link>
                <div className={navigationTopContainer}>
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
                    <span
                        className={navigationProfileSeparator}
                        aria-hidden="true"
                    />
                    <Link to="/settings" className={navigationProfile}>
                        <span>
                            <span className={navigationProfileAvatar}>
                                <User />
                            </span>
                        </span>
                        <span className={navigationProfileInfos}>
                            My account
                        </span>
                    </Link>
                </div>
            </header>
        </div>
    );
}
