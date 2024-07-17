import { DI } from "@frak-labs/shared/context/utils/di";
import { http, createClient } from "viem";
import { arbitrumSepolia } from "viem/chains";

export const getViemClient = DI.registerAndExposeGetter({
    id: "ViemClient",
    isAsync: false,
    getter: () => {
        return createClient({
            // Should depend on the env, and use alchemy
            chain: arbitrumSepolia,
            transport: http(),
        });
    },
});
