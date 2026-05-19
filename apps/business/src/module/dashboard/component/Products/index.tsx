import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/module/common/component/Button";
import { Panel } from "@/module/common/component/Panel";
import { MerchantItem } from "@/module/dashboard/component/MerchantItem";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import * as styles from "./products.css";

export function MyMerchants() {
    const { merchants } = useMyMerchants();

    return (
        <Panel variant={"ghost"} title={"My Merchants"} withBadge={false}>
            <MerchantListSection merchants={merchants} />
        </Panel>
    );
}

function MerchantListSection({
    merchants,
}: {
    merchants: { id: string; name: string; domain: string }[];
}) {
    const navigate = useNavigate();
    return (
        <div className={styles.contentListSection}>
            {merchants.map((merchant) => (
                <MerchantListItem key={merchant.id} merchant={merchant} />
            ))}

            <Button
                size={"none"}
                width={"auto"}
                variant={"ghost"}
                onClick={() => {
                    navigate({ to: "/mint" });
                }}
            >
                <MerchantItem
                    name={
                        <>
                            <Plus />
                            Add a Merchant
                        </>
                    }
                    domain={"domain.com"}
                    showActions={false}
                    isLink={false}
                />
            </Button>
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
