import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { Team } from "@/module/product/component/Team";

/**
 * Merchant team page wrapper
 * Fetches merchant data and extracts productId for on-chain operations
 */
export function MerchantTeam({ merchantId }: { merchantId: string }) {
    const { data: merchant, isLoading } = useMerchant({ merchantId });

    if (isLoading || !merchant) {
        return <Spinner />;
    }

    if (!merchant.productId) {
        return (
            <div>
                <p>
                    Team management requires an on-chain product ID which is not
                    yet available for this merchant.
                </p>
            </div>
        );
    }

    return <Team productId={merchant.productId} />;
}
