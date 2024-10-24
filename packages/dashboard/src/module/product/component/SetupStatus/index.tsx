"use client";

import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { FormLayout } from "@/module/forms/Form";
import { ProductHead } from "@/module/product/component/ProductHead";
import {
    type ProductSetupStatusItem,
    useProductSetupStatus,
} from "@/module/product/hook/useProductSetupStatus";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@module/component/Accordion";
import { Spinner } from "@module/component/Spinner";
import type { Hex } from "viem";
import styles from "./index.module.css";
import {AlertCircle, BadgeCheck} from "lucide-react";

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
                        <SetupStatusItems items={data.items ?? []} hasWarning={data.hasWarning} />
                )}
            </Panel>
        </FormLayout>
    );
}

function SetupStatusItems({ items, hasWarning }: { items: ProductSetupStatusItem[], hasWarning: boolean }) {
    return (
        <div>
            <Row>
                {hasWarning
                    ? "Some items need your attention. Please review and resolve the warnings."
                    : "Great job! Your product is set up correctly."}

                {items.map((item) => (
                    <SetupStatusItem key={item.key} item={item} />
                ))}
            </Row>
        </div>
    );
}

function SetupStatusItem({ item }: { item: ProductSetupStatusItem }) {
    return (
        <>
            <Accordion
                type={"single"}
                collapsible
                className={styles.stepItemAccordion}
            >
                <AccordionItem value={"item-1"}>
                    <AccordionTrigger
                        className={styles.stepItemAccordion__trigger}
                    >
                        <Title
                            size={"small"}
                            icon={
                                item.status === "ok" ? (
                                    <BadgeCheck color={"#0DDB84"} />
                                ) : (
                                    <AlertCircle color={"#db960d"} />
                                )
                            }
                        >
                            {item.name}
                        </Title>
                    </AccordionTrigger>
                    <AccordionContent>
                        <p>{item.description}</p>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </>
    );
}
