import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, ChevronDownIcon } from "@frak-labs/design-system/icons";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import clsx from "clsx";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import * as styles from "./merchant-switcher.css";

type SwitcherMerchant = {
    id: string;
    name: string;
    domain: string;
};

function initialOf(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return "?";
    const first = Array.from(trimmed)[0] ?? "?";
    return first.toUpperCase();
}

function MerchantBadge({ name }: { name: string }) {
    return (
        <span aria-hidden="true" className={styles.badge}>
            {initialOf(name)}
        </span>
    );
}

/**
 * Sections whose URL has no merchant-specific resource id in it — safe
 * to carry over to another merchant. Anything else (campaign details,
 * drafts, edit screens) targets a resource that belongs to the source
 * merchant and would 404 under the new one, so we fall back to the
 * dashboard.
 */
const SAFE_SECTIONS = [
    "/dashboard",
    "/campaigns/list",
    "/campaigns/performance",
    "/members",
    "/merchant",
    "/merchant/funding",
    "/merchant/customize",
    "/merchant/team",
    "/merchant/setup-status",
    // `/push/*` is intentionally *not* listed: the push composition lives
    // in `pushCreationStore` and isn't merchant-scoped, so carrying it
    // across merchants would silently re-target a draft. Switching from
    // there falls back to the merchant dashboard.
];

/**
 * Map the current URL to the equivalent path under a different merchant
 * so switching preserves the section the user is in
 * (e.g. `/m/A/campaigns/list` → `/m/B/campaigns/list`).
 */
function buildSwitchTarget(pathname: string, merchantId: string): string {
    const match = pathname.match(/^\/m\/[^/]+(\/.*)?$/);
    const tail = match?.[1] ?? "/dashboard";
    const safe = SAFE_SECTIONS.includes(tail) ? tail : "/dashboard";
    return `/m/${merchantId}${safe}`;
}

export function MerchantSwitcher() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const { owned, adminOf, merchants } = useMyMerchants();
    const { merchantId: activeId } = useParams({ strict: false }) as {
        merchantId?: string;
    };
    // `merchants` is `owned ∪ adminOf`, so a find here is sufficient.
    const active = merchants.find((m) => m.id === activeId);

    if (!active) return null;

    const isSingle = merchants.length <= 1;

    if (isSingle) {
        return (
            <span className={styles.staticTrigger} data-readonly>
                <MerchantBadge name={active.name} />
                <Text as="span" variant="caption" className={styles.label}>
                    {active.name}
                </Text>
            </span>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={styles.trigger}
                    aria-label={t("shell.header.merchantSwitcher.label")}
                    aria-haspopup="listbox"
                >
                    <MerchantBadge name={active.name} />
                    <Text as="span" variant="caption" className={styles.label}>
                        {active.name}
                    </Text>
                    <ChevronDownIcon
                        width={14}
                        height={14}
                        className={styles.chevron}
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className={styles.menu}>
                {owned.length > 0 && (
                    <Section
                        heading={t("shell.header.merchantSwitcher.owned")}
                        merchants={owned}
                        activeId={active.id}
                        pathname={pathname}
                        onSelect={() => setOpen(false)}
                    />
                )}
                {adminOf.length > 0 && (
                    <Section
                        heading={t("shell.header.merchantSwitcher.adminOf")}
                        merchants={adminOf}
                        activeId={active.id}
                        pathname={pathname}
                        onSelect={() => setOpen(false)}
                    />
                )}
            </PopoverContent>
        </Popover>
    );
}

function Section({
    heading,
    merchants,
    activeId,
    pathname,
    onSelect,
}: {
    heading: string;
    merchants: SwitcherMerchant[];
    activeId: string;
    pathname: string;
    onSelect: () => void;
}) {
    return (
        <div className={styles.section}>
            <div className={styles.sectionHeading}>
                <Text as="span" variant="caption" color="tertiary">
                    {heading}
                </Text>
            </div>
            <ul className={styles.list}>
                {merchants.map((merchant) => {
                    const isActive = merchant.id === activeId;
                    return (
                        <li key={merchant.id} className={styles.item}>
                            <Link
                                to={buildSwitchTarget(pathname, merchant.id)}
                                replace
                                className={clsx(
                                    styles.itemLink,
                                    isActive && styles.itemLinkActive
                                )}
                                onClick={onSelect}
                            >
                                <MerchantBadge name={merchant.name} />
                                <span className={styles.itemBody}>
                                    <Text as="span" variant="caption">
                                        {merchant.name}
                                    </Text>
                                    {merchant.domain && (
                                        <Text
                                            as="span"
                                            variant="caption"
                                            color="tertiary"
                                            className={styles.itemDomain}
                                        >
                                            {merchant.domain}
                                        </Text>
                                    )}
                                </span>
                                {isActive && (
                                    <CheckIcon
                                        width={16}
                                        height={16}
                                        className={styles.itemCheck}
                                    />
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
