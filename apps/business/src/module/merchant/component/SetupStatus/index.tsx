import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { ProductSetupStatus } from "@/module/product/component/SetupStatus";

/**
 * Merchant setup status page wrapper
 * Fetches merchant data and extracts productId for on-chain operations
 */
export function MerchantSetupStatus({ merchantId }: { merchantId: string }) {
    const { data: merchant, isLoading } = useMerchant({ merchantId });

    if (isLoading || !merchant) {
        return <Spinner />;
    }

    if (!merchant.productId) {
        return (
            <div>
                <p>
                    Setup status requires an on-chain product ID which is not
                    yet available for this merchant.
                </p>
            </div>
        );
    }

    return <ProductSetupStatus productId={merchant.productId} />;
}
