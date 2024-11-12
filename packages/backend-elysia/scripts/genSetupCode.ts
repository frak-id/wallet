import { concatHex, keccak256, toHex } from "viem";

// Var for the setup code generation
// const domain = "moov360.com";
const domain = "test01.frak.id";
const owner = "0xd64b31C0a06aC2cA02374DF233c550c38D94BA78";

// Gen the setup code
const setupCode = keccak256(
    concatHex([
        toHex(domain),
        owner,
        toHex(process.env.PRODUCT_SETUP_CODE_SALT ?? ""),
    ])
);

console.log(`Setup code for ${domain} and owner ${owner}:`);
console.log(`- ${setupCode}`);
process.exit(0);
