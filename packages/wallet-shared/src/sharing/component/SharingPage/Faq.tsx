import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Minus, Plus } from "lucide-react";
import { RewardBreakdown } from "./RewardBreakdown";
import * as styles from "./sharingPage.css";
import type { SharingReward, SharingT } from "./types";

/**
 * The FAQ entries, in display order. `id` is the i18n key suffix (`faq.q1`), not
 * the array index — these keys are a merchant-override surface and must stay
 * stable across reordering. `slot` names extra content rendered under the answer.
 */
const FAQ_ITEMS = [
    { id: "1" },
    { id: "2" },
    { id: "3" },
    { id: "4" },
    { id: "5" },
    { id: "6", slot: "rewardBreakdown" },
] as const satisfies readonly {
    id: string;
    slot?: "rewardBreakdown";
}[];

export function Faq({ reward, t }: { reward: SharingReward; t: SharingT }) {
    const breakdown = reward.status === "ready" ? reward.breakdown : undefined;

    return (
        <Stack as="section" space="m" className={styles.faqWrapper}>
            <Text as="h3" variant="heading3" className={styles.faqTitle}>
                {t("sdk.sharingPage.faq.title")}
            </Text>
            <Accordion type="single" collapsible className={styles.faqList}>
                {FAQ_ITEMS.map((item) => (
                    <AccordionItem
                        key={item.id}
                        value={`faq-${item.id}`}
                        className={styles.faqItem}
                    >
                        <AccordionTrigger className={styles.faqTrigger}>
                            {t(`sdk.sharingPage.faq.q${item.id}`)}
                            <Plus
                                size={20}
                                className={`${styles.faqIcon} ${styles.faqIconPlus}`}
                            />
                            <Minus
                                size={20}
                                className={`${styles.faqIcon} ${styles.faqIconMinus}`}
                            />
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className={styles.faqContent}>
                                {t(`sdk.sharingPage.faq.a${item.id}`)}
                                {"slot" in item &&
                                    item.slot === "rewardBreakdown" &&
                                    breakdown && (
                                        <RewardBreakdown
                                            referrer={breakdown.referrer}
                                            referee={breakdown.referee}
                                            minPurchaseValue={
                                                breakdown.minPurchaseValue
                                            }
                                            t={t}
                                        />
                                    )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </Stack>
    );
}
