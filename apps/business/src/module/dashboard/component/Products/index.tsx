import { Stack } from "@frak-labs/design-system/components/Stack";
import { Title } from "@/module/common/component/Title";
import { MerchantItem } from "@/module/dashboard/component/MerchantItem";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import * as styles from "./products.css";

export function MyMerchants() {
    const { merchants } = useMyMerchants();

    return (
        <Stack as="section" space="m">
            <Title size="small">My Merchants</Title>
            <MerchantListSection merchants={merchants} />
        </Stack>
    );
}

function MerchantListSection({
    merchants,
}: {
    merchants: { id: string; name: string; domain: string }[];
}) {
    return (
        <div className={styles.contentListSection}>
            {merchants.map((merchant) => (
                <MerchantListItem key={merchant.id} merchant={merchant} />
            ))}
        </div>
    );
}

function MerchantListItem({
    merchant,
}: {
    merchant: { id: string; name: string; domain: string };
}) {
    const { id, name, domain } = merchant;
    return <MerchantItem merchantId={id} name={name} domain={domain} />;
}
