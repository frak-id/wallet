import { Stack } from "@frak-labs/design-system/components/Stack";
import { createFileRoute } from "@tanstack/react-router";
import { BillingTab } from "@/module/settings/billing/BillingTab";

export const Route = createFileRoute("/_restricted/settings/billing")({
    component: BillingSettings,
});

function BillingSettings() {
    return (
        <Stack space="l">
            <BillingTab />
        </Stack>
    );
}
