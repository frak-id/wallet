import type { SSTConfig } from "sst";
import { ConfigStack } from "./iac/Config";
import { ExampleAppStack } from "./iac/ExampleWebApp";
import { WalletAppStack } from "./iac/WalletWebApp";

export default {
    config(_input) {
        return {
            name: "wallet",
            region: "eu-west-1",
        };
    },
    stacks(app) {
        app.stack(ConfigStack);
        app.stack(WalletAppStack);
        app.stack(ExampleAppStack);
    },
} satisfies SSTConfig;
