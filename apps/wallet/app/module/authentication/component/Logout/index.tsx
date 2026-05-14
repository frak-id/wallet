import { Button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogout } from "@/module/authentication/hook/useLogout";
import * as styles from "./index.css";

/**
 * Logout from current authentication
 */
export function Logout() {
    const { t } = useTranslation();
    const { logout, isLoggingOut } = useLogout();

    return (
        <Button
            disabled={isLoggingOut}
            onClick={logout}
            icon={isLoggingOut ? <Spinner size="s" /> : <LogOut size={20} />}
            className={styles.logoutButton}
        >
            {t("common.logout")}
        </Button>
    );
}
