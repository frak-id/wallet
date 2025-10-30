import { Button } from "@frak-labs/ui/component/Button";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, BadgeCheck } from "lucide-react";
import type { Hex } from "viem";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { FormLayout } from "@/module/forms/Form";
import { ProductHead } from "@/module/product/component/ProductHead";
import {
    type ProductSetupStatusItem,
    useProductSetupStatus,
} from "@/module/product/hook/useProductSetupStatus";
import styles from "./index.module.css";

/**
 * Page containing basic product setup status overview
 */
export function ProductSetupStatus({ productId }: { productId: Hex }) {
    const { data, isLoading, isPending } = useProductSetupStatus({ productId });

    if (isLoading || isPending) {
        return (
            <FormLayout>
                <ProductHead productId={productId} />
                <Panel title={"Product setup status"}>
                    <p>Loading setup status...</p>
                </Panel>
            </FormLayout>
        );
    }

    if (!data) {
        return (
            <FormLayout>
                <ProductHead productId={productId} />
                <Panel title={"Product setup status"}>
                    <p className={styles.placeholder}>
                        Unable to load setup status.
                    </p>
                </Panel>
            </FormLayout>
        );
    }

    return (
        <FormLayout>
            <ProductHead productId={productId} />
            <Panel title={"Product setup status"}>
                <SetupStatusItems
                    items={data.items ?? []}
                    hasWarning={data.hasWarning}
                />
            </Panel>
        </FormLayout>
    );
}

function SetupStatusItems({
    items,
    hasWarning,
}: {
    items: ProductSetupStatusItem[];
    hasWarning: boolean;
}) {
    return (
        <div>
            <Row>
                <OverallStatus hasWarning={hasWarning} />

                {items.map((item, index) => (
                    <SetupStatusItem
                        key={item.key + index.toString()}
                        item={item}
                        position={index + 1}
                    />
                ))}
            </Row>
        </div>
    );
}

function OverallStatus({ hasWarning }: { hasWarning: boolean }) {
    if (!hasWarning) {
        return (
            <div className={styles.overallStatus__success}>
                <Badge variant={"success"}>All Setup Complete</Badge>
                <p>Great job! Your product is set up correctly.</p>
            </div>
        );
    }

    return (
        <div className={styles.overallStatus__warning}>
            <Badge variant={"warning"}>Action Required</Badge>
            <p>
                Some items need your attention.
                <br />
                Please review and complete them.
            </p>
        </div>
    );
}

function SetupStatusItem({
    item,
    position,
}: {
    item: ProductSetupStatusItem;
    position: number;
}) {
    if (item.isGood) {
        return <SuccessStatusItem item={item} position={position} />;
    }

    return <WarningStatusItem item={item} position={position} />;
}

function SuccessStatusItem({
    item,
    position,
}: {
    item: ProductSetupStatusItem;
    position: number;
}) {
    return (
        <div className={styles.stepItem}>
            <div className={styles.header}>
                <span className={styles.stepPosition}>{position}</span>
                <span className={styles.stepName}>
                    {item.name}
                    <BadgeCheck className={styles.icon} />
                </span>
            </div>
            <p className={styles.description}>{item.description}</p>
        </div>
    );
}

function WarningStatusItem({
    item,
    position,
}: {
    item: ProductSetupStatusItem;
    position: number;
}) {
    const navigate = useNavigate();
    return (
        <div className={styles.stepItem}>
            <div className={styles.header}>
                <span className={styles.stepPosition}>{position}</span>
                <span className={styles.stepName}>
                    {item.name}
                    <AlertCircle className={styles.iconWarning} />
                </span>
            </div>
            <p className={styles.description}>{item.description}</p>
            <div className={styles.actions}>
                <Button
                    variant={"information"}
                    onClick={() => navigate({ to: item.resolvingPage })}
                >
                    Complete this step
                </Button>
                {item.documentationLink && (
                    <a
                        href={item.documentationLink}
                        target={"_blank"}
                        rel={"noreferrer"}
                    >
                        <Button variant={"secondary"}>Documentation</Button>
                    </a>
                )}
            </div>
        </div>
    );
}
