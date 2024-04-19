import { AccordionRecoveryItem } from "@/module/recovery/component/AccordionItem";
import { getStatusCurrentStep } from "@/module/recovery/component/Setup";
import { ButtonSetupChain } from "@/module/recovery/component/Setup/ButtonSetupChain";
import { recoveryStepAtom } from "@/module/settings/atoms/recovery";
import { useAtomValue } from "jotai";
import { useConfig } from "wagmi";

const ACTUAL_STEP = 4;

export function Step4() {
    // Get the current step
    const step = useAtomValue(recoveryStepAtom);

    const { chains } = useConfig();

    return (
        <AccordionRecoveryItem
            item={`step-${ACTUAL_STEP}`}
            trigger={<span>{ACTUAL_STEP}. Enable recovery on-chain</span>}
            status={getStatusCurrentStep(ACTUAL_STEP, step)}
        >
            {chains.map((chain) => (
                <ButtonSetupChain key={chain.id} chain={chain} />
            ))}
        </AccordionRecoveryItem>
    );
}
