import { useEffect } from "react";
import { rampFlowStore, selectScreen } from "@/module/ramp/store/rampFlowStore";
import { RampAmountScreen } from "./RampAmountScreen";
import { RampSuccessScreen } from "./RampSuccessScreen";
import { RampSwapScreen } from "./RampSwapScreen";
import { RampWidgetScreen } from "./RampWidgetScreen";

/** Root of the Ramp cash-out: amount, optional EURe→USDC swap, Ramp widget, success. */
export function RampOfframpFlow({ onClose }: { onClose: () => void }) {
    const screen = rampFlowStore(selectScreen);
    useEffect(() => () => rampFlowStore.getState().reset(), []);

    switch (screen) {
        case "swap":
            return <RampSwapScreen />;
        case "widget":
            return <RampWidgetScreen onClose={onClose} />;
        case "success":
            return <RampSuccessScreen onClose={onClose} />;
        default:
            return <RampAmountScreen onClose={onClose} />;
    }
}
