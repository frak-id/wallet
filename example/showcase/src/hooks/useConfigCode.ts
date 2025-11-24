import { useMemo } from "react";
import { useConfigStore } from "@/stores/configStore";
import { getCleanedConfig } from "@/utils/configTransform";

export function useConfigCode(): string {
    const config = useConfigStore((state) => state.config);

    return useMemo(() => {
        const cleaned = getCleanedConfig(config);
        return JSON.stringify(cleaned, null, 2);
    }, [config]);
}
