import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckIcon,
    ChevronDownIcon,
    LogoutIcon,
    ProfileIcon,
    SettingsIcon,
} from "@frak-labs/design-system/icons";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import clsx from "clsx";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLogout } from "@/module/common/hook/useLogout";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import * as styles from "./account-menu.css";
import { buildSwitchTarget } from "./switchTarget";

export function AccountMenu() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const { merchants } = useMyMerchants();
    const { merchantId: activeId } = useParams({ strict: false }) as {
        merchantId?: string;
    };
    const logout = useLogout();

    const hasMerchants = merchants.length > 0;
    const close = () => setOpen(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={styles.trigger}
                    aria-label={t("shell.header.myAccount")}
                    aria-haspopup="menu"
                >
                    <span className={styles.triggerContent}>
                        <span className={styles.avatar}>
                            <ProfileIcon />
                        </span>
                        <Text
                            as="span"
                            variant="body"
                            weight="medium"
                            className={styles.label}
                        >
                            {t("shell.header.myAccount")}
                        </Text>
                    </span>
                    <span
                        className={clsx(
                            styles.chevron,
                            open && styles.chevronOpen
                        )}
                    >
                        <ChevronDownIcon width={24} height={24} />
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className={styles.menu}>
                {hasMerchants && (
                    <ul className={styles.list}>
                        {merchants.map((merchant) => {
                            const isActive = merchant.id === activeId;
                            return (
                                <li key={merchant.id} className={styles.item}>
                                    <Link
                                        to={buildSwitchTarget(
                                            pathname,
                                            merchant.id
                                        )}
                                        replace
                                        className={clsx(
                                            styles.merchantLink,
                                            isActive &&
                                                styles.merchantLinkActive
                                        )}
                                        onClick={close}
                                    >
                                        <span className={styles.merchantBody}>
                                            <Text
                                                as="span"
                                                variant="body"
                                                weight="medium"
                                                className={styles.merchantName}
                                            >
                                                {merchant.name}
                                            </Text>
                                            {merchant.domain && (
                                                <Text
                                                    as="span"
                                                    variant="bodySmall"
                                                    color="secondary"
                                                    className={
                                                        styles.merchantDomain
                                                    }
                                                >
                                                    {merchant.domain}
                                                </Text>
                                            )}
                                        </span>
                                        {isActive && (
                                            <CheckIcon
                                                width={24}
                                                height={24}
                                                className={styles.check}
                                            />
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {hasMerchants && (
                    <div className={styles.divider} aria-hidden="true">
                        <span className={styles.dividerLine} />
                    </div>
                )}
                <Link to="/settings" className={styles.cell} onClick={close}>
                    <span className={styles.cellIcon}>
                        <SettingsIcon width={16} height={16} />
                    </span>
                    <Text as="span" variant="bodySmall" weight="medium">
                        {t("shell.header.account.settings")}
                    </Text>
                </Link>

                <div className={styles.divider} aria-hidden="true">
                    <span className={styles.dividerLine} />
                </div>
                <button
                    type="button"
                    className={styles.cell}
                    onClick={() => {
                        close();
                        logout();
                    }}
                >
                    <span
                        className={clsx(styles.cellIcon, styles.cellIconError)}
                    >
                        <LogoutIcon width={16} height={16} />
                    </span>
                    <Text
                        as="span"
                        variant="bodySmall"
                        weight="medium"
                        color="error"
                    >
                        {t("shell.header.account.logout")}
                    </Text>
                </button>
            </PopoverContent>
        </Popover>
    );
}
