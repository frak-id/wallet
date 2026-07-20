import { concatHex, type Hex, isAddress, keccak256, toHex } from "viem";

// Usage: bun scripts/genSetupCode.ts <domain> <subject>
//   <domain>  the merchant domain (any form, e.g. "https://www.shop.com/")
//   <subject> EITHER a wallet address (wallet users) OR an email (walletless /
//             email-login users). Both are known live at onboarding, so no DB
//             lookup is needed to issue a code.
const [domainArg, subjectArg] = process.argv.slice(2);
if (!domainArg || !subjectArg) {
    console.error(
        "Usage: bun scripts/genSetupCode.ts <domain> <wallet-or-email>"
    );
    process.exit(1);
}

// Normalise the domain exactly like `DnsCheckRepository.getNormalizedDomain`
// (only keep the host, drop `www.`) so the hash matches the backend.
function getNormalizedDomain(domain: string) {
    const baseDomainUrl = domain.startsWith("https://")
        ? domain
        : `https://${domain}`;
    const domainHost = new URL(baseDomainUrl).host;
    return domainHost.replace("www.", "");
}
const domain = getNormalizedDomain(domainArg);

// The code binds to the owner's stable public identifier: the wallet address
// (used as-is), else the lowercased email. Mirrors `setupCodeSubject` in
// `src/infrastructure/dns/DnsCheckRepository.ts`.
const subject: Hex = isAddress(subjectArg)
    ? (subjectArg as Hex)
    : toHex(subjectArg.trim().toLowerCase());

// Gen the setup code
const setupCode = keccak256(
    concatHex([
        toHex(domain),
        subject,
        toHex(process.env.PRODUCT_SETUP_CODE_SALT ?? ""),
    ])
);

console.log(`Setup code for ${domain} and owner ${subjectArg}:`);
console.log(`- ${setupCode}`);
process.exit(0);
