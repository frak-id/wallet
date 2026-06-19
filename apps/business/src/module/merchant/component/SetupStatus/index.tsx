import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import type { LinkProps } from "@tanstack/react-router";
import { AlertCircle, BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { CallOut } from "@/module/common/component/CallOut";
import { LinkButton } from "@/module/common/component/LinkButton";
import { FormLayout } from "@/module/forms/Form";
import {
    type MerchantSetupStatusItem,
    useMerchantSetupStatus,
} from "@/module/merchant/hook/useMerchantSetupStatus";
import * as styles from "./setup-status.css";

export function MerchantSetupStatus({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data } = useMerchantSetupStatus({ merchantId });

    return (
        <FormLayout>
            <Card>
                <CardHeader>
                    <CardTitle>{t("merchant.setupStatus.title")}</CardTitle>
                </CardHeader>
                {!data ? (
                    <Spinner />
                ) : (
                    <SetupStatusItems
                        items={data.items ?? []}
                        hasWarning={data.hasWarning}
                    />
                )}
            </Card>
        </FormLayout>
    );
}

function SetupStatusItems({
    items,
    hasWarning,
}: {
    items: MerchantSetupStatusItem[];
    hasWarning: boolean;
}) {
    return (
        <div>
            <Inline space="m" alignY="bottom">
                <OverallStatus hasWarning={hasWarning} />

                {items.map((item, index) => (
                    <SetupStatusItem
                        key={item.key + index.toString()}
                        item={item}
                        position={index + 1}
                    />
                ))}
            </Inline>
        </div>
    );
}

function OverallStatus({ hasWarning }: { hasWarning: boolean }) {
    const { t } = useTranslation();
    if (!hasWarning) {
        return (
            <CallOut variant={"success"}>
                {t("merchant.setupStatus.success")}
            </CallOut>
        );
    }

    return (
        <CallOut variant={"warning"}>
            {t("merchant.setupStatus.warningLine1")}
            <br />
            {t("merchant.setupStatus.warningLine2")}
        </CallOut>
    );
}

function SetupStatusItem({
    item,
    position,
}: {
    item: MerchantSetupStatusItem;
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
    item: MerchantSetupStatusItem;
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
    item: MerchantSetupStatusItem;
    position: number;
}) {
    const { t } = useTranslation();
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
                    variant="secondary"
                >
                    {t("merchant.setupStatus.completeStep")}
                </LinkButton>
                {item.documentationLink && (
                    <a
                        href={item.documentationLink}
                        target={"_blank"}
                        rel={"noreferrer"}
                    >
                        <Button variant={"secondary"}>
                            {t("merchant.setupStatus.documentation")}
                        </Button>
                    </a>
                )}
            </div>
        </div>
    );
}
