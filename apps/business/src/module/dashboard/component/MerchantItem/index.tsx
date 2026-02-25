import { Link } from "@tanstack/react-router";
import { Pen, Users, WalletMinimal } from "lucide-react";
import type { HTMLAttributes, PropsWithChildren, ReactElement } from "react";
import styles from "./index.module.css";

interface MerchantItemProps
    extends Omit<HTMLAttributes<HTMLSpanElement>, "className"> {
    /**
     * Merchant UUID for navigation
     */
    merchantId?: string;
    name?: string | ReactElement<unknown>;
    domain?: string;
    showActions?: boolean;
    isLink?: boolean;
}

export function MerchantItem({
    merchantId,
    name,
    domain,
    showActions = true,
    isLink = true,
    children,
    ...props
}: PropsWithChildren<MerchantItemProps>) {
    return (
        <span className={styles.merchantItem} {...props}>
            <p className={styles.merchantItem__name}>
                {name}
                {domain && isLink && (
                    <a
                        href={`//${domain}`}
                        target={"_blank"}
                        rel={"noreferrer"}
                        className={styles.merchantItem__domain}
                    >
                        {domain}
                    </a>
                )}
                {domain && !isLink && (
                    <span className={styles.merchantItem__domain}>
                        {domain}
                    </span>
                )}
            </p>
            {showActions && <MerchantActions merchantId={merchantId} />}
        </span>
    );
}

function MerchantActions({ merchantId }: { merchantId?: string }) {
    if (!merchantId) return null;

    return (
        <ul className={styles.merchantItem__actions}>
            <li>
                <Link
                    to="/merchant/$id/funding"
                    params={{ id: merchantId }}
                    title={"Manage the merchant balance"}
                >
                    <WalletMinimal />
                </Link>
            </li>
            <li>
                <Link
                    to="/merchant/$id"
                    params={{ id: merchantId }}
                    title={"Edit your merchant"}
                >
                    <Pen />
                </Link>
            </li>
            <li>
                <Link
                    to="/merchant/$id/team"
                    params={{ id: merchantId }}
                    title={"Manage your team"}
                >
                    <Users />
                </Link>
            </li>
        </ul>
    );
}
