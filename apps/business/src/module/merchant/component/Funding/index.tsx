import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { ProductFunding } from "@/module/product/component/Funding";

/**
 * Merchant funding page wrapper
 * Fetches merchant data and extracts productId for on-chain operations
 */
export function MerchantFunding({ merchantId }: { merchantId: string }) {
    const { data: merchant, isLoading } = useMerchant({ merchantId });

    if (isLoading || !merchant) {
        return <Spinner />;
    }

    if (!merchant.productId) {
        return (
            <div>
                <p>
                    Funding requires an on-chain product ID which is not yet
                    available for this merchant.
                </p>
            </div>
        );
    }

    return <ProductFunding productId={merchant.productId} />;
}
