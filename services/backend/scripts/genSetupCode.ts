import { concatHex, type Hex, keccak256, toHex } from "viem";

// Fill in the (normalised) domain, then EITHER `wallet` (wallet users) OR
// `email` (walletless / email-login users) — leave the other empty. Both are
// known live at onboarding, so no DB lookup is needed to issue a code.
const domain = "";
const wallet = ""; // e.g. "0xabc…" for a wallet user
const email = ""; // e.g. "client@shop.com" for an email-login user

// The code binds to the owner's stable public identifier: the wallet address
// (used as-is), else the lowercased email. Mirrors `setupCodeSubject` in
// `src/infrastructure/dns/DnsCheckRepository.ts`.
const subject: Hex = wallet
    ? (wallet as Hex)
    : toHex(email.trim().toLowerCase());

// Gen the setup code
const setupCode = keccak256(
    concatHex([
        toHex(domain),
        subject,
        toHex(process.env.PRODUCT_SETUP_CODE_SALT ?? ""),
    ])
);

console.log(`Setup code for ${domain} and owner ${wallet || email}:`);
console.log(`- ${setupCode}`);
process.exit(0);
