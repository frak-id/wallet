import { useEnvironment } from "@/module/root/hook/useEnvironment";
import { ReactScan } from "@frak-labs/ui/component/ReactScan";

/**
 * ReactScanWrapper component
 *
 * This component serves as a wrapper for the ReactScan component, conditionally rendering it based on the environment's debug state.
 * It utilizes the useEnvironment hook to determine if the application is in debug mode.
 *
 * @returns {JSX.Element | null} - Returns the ReactScan component if in debug mode, otherwise returns null.
 */
export function ReactScanWrapper() {
    const { isDebug } = useEnvironment();

    return isDebug ? <ReactScan /> : null;
}
