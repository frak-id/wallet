import { Badge } from "@frak-labs/design-system/components/Badge";
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
import { activeMerchantStore } from "@/stores/activeMerchantStore";
import * as styles from "./account-menu.css";
import { buildSwitchTarget } from "./switchTarget";

export function AccountMenu() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const { merchants, isReadOnly } = useMyMerchants();
    const { merchantId: activeId } = useParams({ strict: false }) as {
        merchantId?: string;
    };
    const logout = useLogout();

    const lastMerchantId = activeMerchantStore((s) => s.lastMerchantId);
    const setLastMerchantId = activeMerchantStore((s) => s.setLastMerchantId);

    const hasMerchants = merchants.length > 0;
    const activeMerchant =
        merchants.find((m) => m.id === activeId) ??
        merchants.find((m) => m.id === lastMerchantId) ??
        merchants[0];
    const accountLabel = activeMerchant?.name ?? t("shell.header.myAccount");
    const close = () => setOpen(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={styles.trigger}
                    aria-label={accountLabel}
                    aria-haspopup="menu"
                >
                    <span className={styles.triggerContent}>
                        <span className={styles.avatar}>
                            <ProfileIcon className={styles.avatarIcon} />
                        </span>
                        <Text
                            as="span"
                            variant="body"
                            weight="medium"
                            className={styles.label}
                        >
                            {accountLabel}
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
                            const isActive = merchant.id === activeMerchant?.id;
                            const className = clsx(
                                styles.merchantLink,
                                isActive && styles.merchantLinkActive
                            );
                            const body = (
                                <>
                                    <span className={styles.merchantBody}>
                                        <span className={styles.merchantTitle}>
                                            <Text
                                                as="span"
                                                variant="body"
                                                weight="medium"
                                                className={styles.merchantName}
                                            >
                                                {merchant.name}
                                            </Text>
                                            {isReadOnly(merchant.id) && (
                                                <Badge
                                                    variant="warning"
                                                    size="small"
                                                >
                                                    {t(
                                                        "platformAdmin.readOnlyTag"
                                                    )}
                                                </Badge>
                                            )}
                                        </span>
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
                                </>
                            );
                            return (
                                <li key={merchant.id} className={styles.item}>
                                    {activeId ? (
                                        <Link
                                            to={buildSwitchTarget(
                                                pathname,
                                                merchant.id
                                            )}
                                            replace
                                            // Override global "render" preload so opening stays instant with many merchants.
                                            preload="intent"
                                            className={className}
                                            onClick={close}
                                        >
                                            {body}
                                        </Link>
                                    ) : (
                                        // Param-less route (e.g. /settings):
                                        // switch context in place, stay put.
                                        <button
                                            type="button"
                                            className={className}
                                            onClick={() => {
                                                setLastMerchantId(merchant.id);
                                                close();
                                            }}
                                        >
                                            {body}
                                        </button>
                                    )}
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
