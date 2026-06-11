import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { EditPageLayout } from "@/module/merchant/component/EditPageLayout";
import { TableTeam } from "@/module/merchant/component/TableTeam";
import { useMerchant } from "@/module/merchant/hook/useMerchant";

/**
 * Merchant team page wrapper
 * Fetches merchant data for on-chain operations
 */
export function MerchantTeam({ merchantId }: { merchantId: string }) {
    const { data: merchant, isLoading } = useMerchant({ merchantId });

    return (
        <EditPageLayout merchantId={merchantId} page="team">
            {isLoading || !merchant ? (
                <Spinner />
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Manage your team</CardTitle>
                    </CardHeader>
                    {/* Display the administrators */}
                    <TableTeam merchantId={merchantId} />
                </Card>
            )}
        </EditPageLayout>
    );
}
