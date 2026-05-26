import { TextWithCopy } from "@frak-labs/ui/component/TextWithCopy";
import { Panel } from "@/module/common/component/Panel";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import styles from "./NewsletterShareLink.module.css";

function buildShareUrl(domain: string): string {
    return `https://${domain}/?frakAction=share`;
}

export function NewsletterShareLink({ merchantId }: { merchantId: string }) {
    const { data: merchant } = useMerchant({ merchantId });

    if (!merchant?.domain) return null;

    const shareUrl = buildShareUrl(merchant.domain);

    return (
        <Panel title={"Newsletter sharing link"} withBadge={false}>
            <p className={styles.description}>
                Paste this link into your newsletter or any marketing email.
                When a customer clicks it, your storefront opens with the Frak
                sharing modal, pre-filled with your current campaign rewards, so
                they can share and earn in one tap.
            </p>
            <TextWithCopy text={shareUrl} style={{ width: "100%" }}>
                <pre>{shareUrl}</pre>
            </TextWithCopy>
        </Panel>
    );
}
