import { Link } from "@tanstack/react-router";
import { Palette, Pen, Users, WalletMinimal } from "lucide-react";
import type { HTMLAttributes, PropsWithChildren, ReactElement } from "react";
import {
    merchantItem,
    merchantItemActions,
    merchantItemDomain,
    merchantItemName,
} from "./merchant-item.css";

interface MerchantItemProps
    extends Omit<HTMLAttributes<HTMLSpanElement>, "className"> {
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
        <span className={merchantItem} {...props}>
            <p className={merchantItemName}>
                {name}
                {domain && isLink && (
                    <a
                        href={`//${domain}`}
                        target={"_blank"}
                        rel={"noreferrer"}
                        className={merchantItemDomain}
                    >
                        {domain}
                    </a>
                )}
                {domain && !isLink && (
                    <span className={merchantItemDomain}>{domain}</span>
                )}
            </p>
            {showActions && <MerchantActions merchantId={merchantId} />}
        </span>
    );
}

function MerchantActions({ merchantId }: { merchantId?: string }) {
    if (!merchantId) return null;

    return (
        <ul className={merchantItemActions}>
            <li>
                <Link
                    to="/m/$merchantId/merchant/funding"
                    params={{ merchantId }}
                    title={"Manage the merchant balance"}
                >
                    <WalletMinimal />
                </Link>
            </li>
            <li>
                <Link
                    to="/m/$merchantId/merchant/customize"
                    params={{ merchantId }}
                    title={"Customize SDK appearance"}
                >
                    <Palette />
                </Link>
            </li>
            <li>
                <Link
                    to="/m/$merchantId/merchant"
                    params={{ merchantId }}
                    title={"Edit your merchant"}
                >
                    <Pen />
                </Link>
            </li>
            <li>
                <Link
                    to="/m/$merchantId/merchant/team"
                    params={{ merchantId }}
                    title={"Manage your team"}
                >
                    <Users />
                </Link>
            </li>
        </ul>
    );
}
