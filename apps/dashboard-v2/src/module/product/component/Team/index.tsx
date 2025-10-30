import type { Hex } from "viem";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { FormLayout } from "@/module/forms/Form";
import { ProductHead } from "@/module/product/component/ProductHead";
import { useGetProductAdministrators } from "@/module/product/hook/useGetProductAdministrators";
import { permissionLabels } from "@/module/product/utils/permissions";
import styles from "./index.module.css";

export function Team({ productId }: { productId: Hex }) {
    const {
        data: administrators,
        isLoading,
        isPending,
    } = useGetProductAdministrators({ productId });

    if (isLoading || isPending) {
        return (
            <FormLayout>
                <ProductHead productId={productId} />
                <Panel title={"Manage your team"}>
                    <p>Loading team members...</p>
                </Panel>
            </FormLayout>
        );
    }

    if (!administrators || administrators.length === 0) {
        return (
            <FormLayout>
                <ProductHead productId={productId} />
                <Panel title={"Manage your team"}>
                    <p className={styles.team__placeholder}>
                        No team members found.
                    </p>
                </Panel>
            </FormLayout>
        );
    }

    return (
        <FormLayout>
            <ProductHead productId={productId} />
            <Panel title={"Manage your team"}>
                <div className={styles.team__table}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.table__header}>Wallet</th>
                                <th className={styles.table__header}>
                                    Permissions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {administrators.map((admin) => (
                                <tr
                                    key={admin.wallet}
                                    className={styles.table__row}
                                >
                                    <td className={styles.table__cell}>
                                        <span className={styles.wallet}>
                                            {admin.isMe && (
                                                <span
                                                    className={
                                                        styles.wallet__me
                                                    }
                                                >
                                                    Me:{" "}
                                                </span>
                                            )}
                                            <code
                                                className={
                                                    styles.wallet__address
                                                }
                                            >
                                                {admin.wallet}
                                            </code>
                                        </span>
                                    </td>
                                    <td className={styles.table__cell}>
                                        <div className={styles.permissions}>
                                            {admin.roleDetails.admin ? (
                                                <Badge variant={"success"}>
                                                    Owner
                                                </Badge>
                                            ) : (
                                                Object.entries(
                                                    admin.roleDetails
                                                ).map(([role, hasRole]) => {
                                                    if (
                                                        role === "admin" ||
                                                        !hasRole
                                                    )
                                                        return null;

                                                    const info =
                                                        permissionLabels[
                                                            role as keyof typeof permissionLabels
                                                        ];
                                                    if (!info) return null;

                                                    return (
                                                        <Badge
                                                            key={role}
                                                            variant={
                                                                info.color ??
                                                                "warning"
                                                            }
                                                            title={
                                                                info.description
                                                            }
                                                        >
                                                            {info.shortLabel}
                                                        </Badge>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className={styles.team__note}>
                    Team management actions (add, remove, update roles) will be
                    available soon.
                </p>
            </Panel>
        </FormLayout>
    );
}
