import type { SSTConfig } from "sst";
import { WalletAppStack } from "./stacks/WebApp";

export default {
    config(_input) {
        return {
            name: "wallet",
            region: "eu-west-1",
        };
    },
    stacks(app) {
        app.stack(WalletAppStack);
    },
} satisfies SSTConfig;
