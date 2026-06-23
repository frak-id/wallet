import { useTranslation } from "react-i18next";
import { EditCard } from "@/module/common/component/EditCard";
import { TextWithCopy } from "@/module/common/component/TextWithCopy";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import * as styles from "./merchant-summary.css";

function buildShareUrl(domain: string): string {
    return `https://${domain}/?frakAction=share`;
}

export function NewsletterShareLink({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data: merchant } = useMerchant({ merchantId });

    if (!merchant?.domain) return null;

    const shareUrl = buildShareUrl(merchant.domain);

    return (
        <EditCard
            title={t("merchantEdit.newsletter.title")}
            description={t("merchantEdit.newsletter.description")}
        >
            <div className={styles.detailCells}>
                <div className={styles.detailCell}>
                    <TextWithCopy text={shareUrl}>
                        <span className={styles.cellLabel}>{shareUrl}</span>
                    </TextWithCopy>
                </div>
            </div>
        </EditCard>
    );
}
