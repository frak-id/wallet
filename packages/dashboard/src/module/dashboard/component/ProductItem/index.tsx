import { FolderPlus, Pen, Users } from "lucide-react";
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
        </span>
    );
}

function ProductActions({ id }: { id?: Hex }) {
    if (!id) return null;

    return (
        <ul className={styles.productItem__actions}>
            <li>
                <FolderPlus />
            </li>
            <li>
                <Link href={`/product/${id}`}>
                    <Pen />
                </Link>
            </li>
            <li>
                <Users />
            </li>
            {/* <li>
            <Trash2 />
        </li> */}
        </ul>
    );
}
