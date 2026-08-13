import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { BillingAdminPanel } from "../BillingAdminPanel";
import { BillingInfoCard } from "../BillingInfoCard";
import { BillingTable } from "../BillingTable";
import { useBillingInfo } from "../useBillingInfo";

/**
 * Billing tab body: invoice-informations card, plus the invoices/deposit
 * history table once billing informations have been saved. Platform admins
 * additionally see a deposit/withdraw creation panel (admin-only routes) —
 * merchants themselves never see or reach it.
 */
export function BillingTab() {
    const { hasInfo } = useBillingInfo();
    const { isPlatformAdmin } = useMyMerchants();

    return (
        <>
            {isPlatformAdmin && <BillingAdminPanel />}
            <BillingInfoCard />
            {hasInfo && <BillingTable />}
        </>
    );
}
