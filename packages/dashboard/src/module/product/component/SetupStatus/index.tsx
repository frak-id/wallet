"use client";
import { CallOut } from "@/module/common/component/CallOut";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { FormLayout } from "@/module/forms/Form";
import { ProductHead } from "@/module/product/component/ProductHead";
import {
    type ProductSetupStatusItem,
    useProductSetupStatus,
} from "@/module/product/hook/useProductSetupStatus";
import { Button } from "@shared/module/component/Button";
import { Spinner } from "@shared/module/component/Spinner";
import { AlertCircle, BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Hex } from "viem";
import styles from "./index.module.css";

/**
 * Page containing basic product setup status overview
 *
 * @constructor
 */
export function ProductSetupStatus({ productId }: { productId: Hex }) {
    const { data } = useProductSetupStatus({ productId });

    return (
        <FormLayout>
            <ProductHead productId={productId} />
            <Panel title={"Product setup status"} withBadge={false}>
                {!data ? (
                    <Spinner />
                ) : (
                    <SetupStatusItems
                        items={data.items ?? []}
                        hasWarning={data.hasWarning}
                    />
                )}
            </Panel>
        </FormLayout>
    );
}

function SetupStatusItems({
    items,
    hasWarning,
}: { items: ProductSetupStatusItem[]; hasWarning: boolean }) {
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
            <CallOut variant={"success"}>
                Great job! Your product is set up correctly.
            </CallOut>
        );
    }

    return (
        <CallOut variant={"warning"}>
            Some items need your attention.
            <br />
            Please review and complete them.
        </CallOut>
    );
}

function SetupStatusItem({
    item,
    position,
}: { item: ProductSetupStatusItem; position: number }) {
    if (item.isGood) {
        return <SuccessStatusItem item={item} position={position} />;
    }

    return <WarningStatusItem item={item} position={position} />;
}

function SuccessStatusItem({
    item,
    position,
}: { item: ProductSetupStatusItem; position: number }) {
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
}: { item: ProductSetupStatusItem; position: number }) {
    const router = useRouter();
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
                    onClick={() => router.push(item.resolvingPage)}
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
