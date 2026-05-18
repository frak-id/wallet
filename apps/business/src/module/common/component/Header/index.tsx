import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { ButtonRefresh } from "@/module/common/component/ButtonRefresh";
import { LogoFrak } from "@/module/common/component/LogoFrak";
import {
    demoModeBadge,
    header,
    headerLogo,
    navigationProfile,
    navigationProfileAvatar,
    navigationProfileInfos,
    navigationTopContainer,
} from "./header.css";

export function Header() {
    const isDemoMode = useIsDemoMode();

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
