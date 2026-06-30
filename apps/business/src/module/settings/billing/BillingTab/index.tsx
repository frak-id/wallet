import { BillingInfoCard } from "../BillingInfoCard";
import { BillingTable } from "../BillingTable";
import { useBillingInfo } from "../useBillingInfo";

/**
 * Billing tab body: invoice-informations card, plus the invoices/deposit
 * history table once billing informations have been saved.
 */
export function BillingTab() {
    const { hasInfo } = useBillingInfo();

    return (
        <>
            <BillingInfoCard />
            {hasInfo && <BillingTable />}
        </>
    );
}
