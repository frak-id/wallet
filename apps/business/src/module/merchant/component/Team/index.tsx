import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { FormLayout } from "@/module/forms/Form";
import { TableTeam } from "@/module/merchant/component/TableTeam";
import { useMerchant } from "@/module/merchant/hook/useMerchant";

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

    return (
        <FormLayout>
            <Card>
                <CardHeader>
                    <CardTitle>Manage your team</CardTitle>
                </CardHeader>
                {/* Display the administrators */}
                <TableTeam merchantId={merchantId} />
            </Card>
        </FormLayout>
    );
}
