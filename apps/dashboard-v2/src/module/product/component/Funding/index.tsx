import { BadgeCheck, CheckCircle, XCircle } from "lucide-react";
import type { Hex } from "viem";
import { formatUnits } from "viem";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { FormLayout } from "@/module/forms/Form";
import { ProductHead } from "@/module/product/component/ProductHead";
import {
    type ProductBank,
    useGetProductFunding,
} from "@/module/product/hook/useGetProductFunding";
import styles from "./index.module.css";

/**
 * Product funding page (simplified read-only version)
 */
export function ProductFunding({ productId }: { productId: Hex }) {
    const { data, isLoading, isPending } = useGetProductFunding({ productId });

    if (isLoading || isPending) {
        return (
            <FormLayout>
                <ProductHead productId={productId} />
                <Panel title={"Product Funding"}>
                    <p>Loading funding information...</p>
                </Panel>
            </FormLayout>
        );
    }

    if (!data || data.length === 0) {
        return (
            <FormLayout>
                <ProductHead productId={productId} />
                <Panel title={"Product Funding"}>
                    <p className={styles.placeholder}>
                        No funding banks configured yet.
                    </p>
                </Panel>
            </FormLayout>
        );
    }

    return (
        <FormLayout>
            <ProductHead productId={productId} />
            {data.map((bank) => (
                <ProductBankPanel key={bank.address} bank={bank} />
            ))}
            <Panel title={"Funding Actions"} variant={"secondary"}>
                <p className={styles.note}>
                    Funding management actions (add funds, withdraw, toggle
                    distribution, add new bank) will be available soon.
                </p>
            </Panel>
        </FormLayout>
    );
}

/**
 * Individual bank panel display
 */
function ProductBankPanel({ bank }: { bank: ProductBank }) {
    const { symbol, decimals } = bank.token;

    // Format balances
    const balance = formatUnits(bank.balance, decimals);
    const distributed = formatUnits(bank.totalDistributed, decimals);
    const claimed = formatUnits(bank.totalClaimed, decimals);

    return (
        <Panel className={styles.bankPanel}>
            <div className={styles.bankContent}>
                {/* Header with title and status badge */}
                <div className={styles.bankHeader}>
                    <Title as={"h3"} size={"small"}>
                        <BadgeCheck
                            className={styles.bankIcon}
                            color={"#0DDB84"}
                        />
                        {bank.token.name} Bank
                    </Title>
                    <Badge variant={bank.isDistributing ? "success" : "danger"}>
                        {bank.isDistributing ? (
                            <CheckCircle size={16} />
                        ) : (
                            <XCircle size={16} />
                        )}
                        {bank.isDistributing ? "Active" : "Inactive"}
                    </Badge>
                </div>

                {/* Balance information */}
                <div className={styles.bankSection}>
                    <h4 className={styles.sectionTitle}>Balance Information</h4>
                    <div className={styles.balanceGrid}>
                        <div className={styles.balanceItem}>
                            <span className={styles.balanceLabel}>
                                Current Balance:
                            </span>
                            <span className={styles.balanceValue}>
                                {balance} {symbol}
                            </span>
                        </div>
                        <div className={styles.balanceItem}>
                            <span className={styles.balanceLabel}>
                                Total Distributed:
                            </span>
                            <span className={styles.balanceValue}>
                                {distributed} {symbol}
                            </span>
                        </div>
                        <div className={styles.balanceItem}>
                            <span className={styles.balanceLabel}>
                                Total Claimed:
                            </span>
                            <span className={styles.balanceValue}>
                                {claimed} {symbol}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Distribution status */}
                <div className={styles.bankSection}>
                    <h4 className={styles.sectionTitle}>
                        Campaigns Funding Status
                    </h4>
                    <p className={styles.statusText}>
                        {bank.isDistributing
                            ? "This bank is actively distributing funds to campaigns. Users can receive rewards from active campaigns."
                            : "This bank is currently inactive. Enable distribution to allow campaigns to use these funds for rewards."}
                    </p>
                </div>

                {/* Token information */}
                <div className={styles.bankSection}>
                    <h4 className={styles.sectionTitle}>Token Information</h4>
                    <div className={styles.tokenInfo}>
                        <p>
                            <strong>Symbol:</strong> {symbol}
                        </p>
                        <p>
                            <strong>Name:</strong> {bank.token.name}
                        </p>
                        <p>
                            <strong>Decimals:</strong> {decimals}
                        </p>
                        <p className={styles.address}>
                            <strong>Address:</strong>{" "}
                            <code>{bank.token.address}</code>
                        </p>
                    </div>
                </div>
            </div>
        </Panel>
    );
}
