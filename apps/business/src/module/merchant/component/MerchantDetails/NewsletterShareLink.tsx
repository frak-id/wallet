import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { TextWithCopy } from "@/module/common/component/TextWithCopy";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { summaryDescription } from "./merchant-summary.css";
import * as styles from "./newsletter-share-link.css";

function buildShareUrl(domain: string): string {
    return `https://${domain}/?frakAction=share`;
}

export function NewsletterShareLink({ merchantId }: { merchantId: string }) {
    const { data: merchant } = useMerchant({ merchantId });

    if (!merchant?.domain) return null;

    const shareUrl = buildShareUrl(merchant.domain);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Newsletter sharing link</CardTitle>
            </CardHeader>
            <Stack space="m">
                <p className={summaryDescription}>
                    Paste this link into your newsletter or any marketing
                    email. When a customer clicks it, your storefront opens
                    with the Frak sharing modal, pre-filled with your current
                    campaign rewards, so they can share and earn in one tap.
                </p>
                <TextWithCopy text={shareUrl}>
                    <pre className={styles.shareUrl}>{shareUrl}</pre>
                </TextWithCopy>
            </Stack>
        </Card>
    );
}
