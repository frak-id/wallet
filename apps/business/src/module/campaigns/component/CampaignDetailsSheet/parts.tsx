import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./campaign-details-sheet.css";

/** Shortens a wallet address to `0x742d…f0bEb0` for compact display. */
export function truncateWallet(wallet: string) {
    // Short enough that head+tail would overlap — show as-is.
    if (wallet.length <= 13) {
        return wallet;
    }
    return `${wallet.slice(0, 6)}…${wallet.slice(-6)}`;
}

/** Locale-bound number/currency/percent formatters for the details sheet. */
export function useDetailFormatters() {
    const { i18n } = useTranslation();
    const locale = i18n.language;
    return useMemo(
        () => ({
            integer: new Intl.NumberFormat(locale, {
                maximumFractionDigits: 0,
            }),
            decimal1: new Intl.NumberFormat(locale, {
                maximumFractionDigits: 1,
            }),
            currency: new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 2,
            }),
            currency0: new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
            }),
            percent0: new Intl.NumberFormat(locale, {
                style: "percent",
                maximumFractionDigits: 0,
            }),
            percent1: new Intl.NumberFormat(locale, {
                style: "percent",
                maximumFractionDigits: 1,
            }),
        }),
        [locale]
    );
}

/**
 * Large metric value. For currency amounts the cents render smaller (Figma
 * "Decimals" slot); counts, percentages and ratios stay a single size. The
 * whole value is exposed to assistive tech as one unit via `aria-label`.
 */
export function BigNumber({
    format,
    value,
    prefix,
}: {
    format: Intl.NumberFormat;
    value: number;
    prefix?: string;
}) {
    const ariaLabel = `${prefix ?? ""}${format.format(value)}`;
    const parts = format.formatToParts(value);
    const hasCurrency = parts.some((part) => part.type === "currency");

    return (
        <span className={styles.amount} role="img" aria-label={ariaLabel}>
            {prefix}
            {hasCurrency
                ? parts.map((part, index) =>
                      part.type === "fraction" || part.type === "decimal" ? (
                          <span
                              key={`${part.type}-${index}`}
                              className={styles.amountFraction}
                          >
                              {part.value}
                          </span>
                      ) : (
                          part.value
                      )
                  )
                : format.format(value)}
        </span>
    );
}

export function TrendLine({
    trend,
    tone,
    children,
}: {
    trend: "up" | "down";
    tone: "success" | "warning";
    children: ReactNode;
}) {
    return (
        <Text
            as="span"
            variant="bodySmall"
            weight="medium"
            color={tone}
            className={styles.trendLine}
        >
            <span aria-hidden="true">{trend === "up" ? "▲" : "▼"}</span>{" "}
            {children}
        </Text>
    );
}

export function Section({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <Stack space="xs" as="section">
            <Text as="h3" variant="bodySmall" weight="medium" color="secondary">
                {title}
            </Text>
            {children}
        </Stack>
    );
}

/** Label + optional descriptor, big value, optional sub-line and footer. */
export function MetricCard({
    label,
    descriptor,
    children,
    sub,
    footer,
}: {
    label: string;
    descriptor?: string;
    children: ReactNode;
    sub?: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <Card radius="m">
            <Stack space="xxs">
                <Inline space="xs" alignY="baseline">
                    <Text
                        as="span"
                        variant="bodySmall"
                        weight="medium"
                        color="secondary"
                    >
                        {label}
                    </Text>
                    {descriptor && (
                        <Text as="span" variant="caption" color="disabled">
                            {descriptor}
                        </Text>
                    )}
                </Inline>
                {children}
                {sub && (
                    <Text as="span" variant="bodySmall" color="tertiary">
                        {sub}
                    </Text>
                )}
                {footer}
            </Stack>
        </Card>
    );
}
