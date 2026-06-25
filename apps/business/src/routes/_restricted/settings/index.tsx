import { Stack } from "@frak-labs/design-system/components/Stack";
import { createFileRoute } from "@tanstack/react-router";
import { CurrencyCard } from "@/module/settings/CurrencyCard";
import { DemoModeCard } from "@/module/settings/DemoModeCard";
import { LanguageCard } from "@/module/settings/LanguageCard";
import { WalletAddressCard } from "@/module/settings/WalletAddressCard";

export const Route = createFileRoute("/_restricted/settings/")({
    component: UsageSettings,
});

function UsageSettings() {
    return (
        <Stack space="l">
            <WalletAddressCard />
            <CurrencyCard />
            <LanguageCard />
            <DemoModeCard />
        </Stack>
    );
}
