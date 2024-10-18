import { Config } from "sst/node/config";
import { concatHex, keccak256, toHex } from "viem";

// Var for the setup code generation
const domain = "";
const owner = "0x";

// Gen the setup code
const setupCode = keccak256(
    concatHex([
        toHex(domain),
        owner,
        toHex(Config.PRODUCT_SETUP_CODE_SALT ?? ""),
    ])
);

console.log(`Setup code for ${domain} and owner ${owner}:`);
console.log(`- ${setupCode}`);
process.exit(0);
