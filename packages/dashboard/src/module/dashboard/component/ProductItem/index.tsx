import { Pen, Users, WalletMinimal } from "lucide-react";
import Link from "next/link";
import type { HTMLAttributes, PropsWithChildren, ReactElement } from "react";
import type { Hex } from "viem";
import styles from "./index.module.css";

interface ProductItemProps
    extends Omit<HTMLAttributes<HTMLSpanElement>, "className"> {
    id?: Hex;
    name?: string | ReactElement;
    domain?: string;
    showActions?: boolean;
    isLink?: boolean;
}

export function ProductItem({
    id,
    name,
    domain,
    showActions = true,
    isLink = true,
    children,
    ...props
}: PropsWithChildren<ProductItemProps>) {
    return (
        <span className={styles.productItem} {...props}>
            <p className={styles.productItem__name}>
                {name}
                {domain && isLink && (
                    <a
                        href={`//${domain}`}
                        target={"_blank"}
                        rel={"noreferrer"}
                        className={styles.productItem__domain}
                    >
                        {domain}
                    </a>
                )}
                {domain && !isLink && (
                    <span className={styles.productItem__domain}>{domain}</span>
                )}
            </p>
            {showActions && <ProductActions id={id} />}
            {/*<ProductStatus id={id} />*/}
        </span>
    );
}

function ProductActions({ id }: { id?: Hex }) {
    if (!id) return null;

    return (
        <ul className={styles.productItem__actions}>
            <li>
                <Link
                    href={`/product/${id}/funding`}
                    title={"Manage the product balance"}
                >
                    <WalletMinimal />
                </Link>
            </li>
            <li>
                <Link href={`/product/${id}`} title={"Edit your product"}>
                    <Pen />
                </Link>
            </li>
            <li>
                <Link href={`/product/${id}/team`} title={"Manage your team"}>
                    <Users />
                </Link>
            </li>
        </ul>
    );
}

// function ProductStatus({ id }: { id?: Hex }) {
//     if (!id) return null;
//
//     return (
//         <span className={styles.productItem__status}>
//             <ProductStatusInner id={id} />
//         </span>
//     );
// }

// function ProductStatusInner({ id }: { id: Hex }) {
//     const { data } = useProductSetupStatus({ productId: id });
//     const { navigateWithTransition } = useAnimatedRouter();
//
//     if (!data) return <Spinner />;
//
//     if (data.hasWarning) {
//         return (
//             <Tooltip
//                 content={
//                     "Finish your product configuration to provide your customer the best experience."
//                 }
//             >
//                 <AlertCircle
//                     color={"#ff7a00"}
//                     onClick={() =>
//                         navigateWithTransition(`/product/${id}/setup-status`)
//                     }
//                 />
//             </Tooltip>
//         );
//     }
//
//     return (
//         <Tooltip content={"Product functional."}>
//             <BadgeCheck
//                 color={"#0ddb84"}
//                 onClick={() =>
//                     navigateWithTransition(`/product/${id}/setup-status`)
//                 }
//             />
//         </Tooltip>
//     );
// }
