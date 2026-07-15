import { Stack } from "@frak-labs/design-system/components/Stack";
import { createFileRoute } from "@tanstack/react-router";
import { CurrencyCard } from "@/module/settings/CurrencyCard";
import { DemoModeCard } from "@/module/settings/DemoModeCard";
import { LanguageCard } from "@/module/settings/LanguageCard";
import { SecurityCard } from "@/module/settings/security/SecurityCard";
import { WalletAddressCard } from "@/module/settings/WalletAddressCard";

export const Route = createFileRoute("/_restricted/settings/")({
    component: UsageSettings,
});

function UsageSettings() {
    return (
        <Stack space="l">
            <WalletAddressCard />
            <SecurityCard />
            <CurrencyCard />
            <LanguageCard />
            <DemoModeCard />
        </Stack>
    );
}
