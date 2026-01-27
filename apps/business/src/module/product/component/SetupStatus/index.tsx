import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import type { LinkProps } from "@tanstack/react-router";
import { AlertCircle, BadgeCheck } from "lucide-react";
import { CallOut } from "@/module/common/component/CallOut";
import { LinkButton } from "@/module/common/component/LinkButton";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { FormLayout } from "@/module/forms/Form";
import {
    type ProductSetupStatusItem,
    useProductSetupStatus,
} from "@/module/product/hook/useProductSetupStatus";
import styles from "./index.module.css";

/**
 * Page containing basic product setup status overview
 * @param merchantId - The merchant UUID for URL generation
 */
export function ProductSetupStatus({ merchantId }: { merchantId: string }) {
    const { data } = useProductSetupStatus({ merchantId });

    return (
        <FormLayout>
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
                <LinkButton
                    to={item.resolvingPage as LinkProps["to"]}
                    variant="information"
                >
                    Complete this step
                </LinkButton>
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
