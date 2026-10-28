import {
    DnsCheckRepository,
    setupCodeFor,
} from "../src/infrastructure/dns/DnsCheckRepository";

// Usage: bun scripts/genSetupCode.ts <domain> <wallet-or-email>
//   <domain>  the merchant domain, in any form ("https://www.shop.com/")
//   <subject> the owner's wallet address, or their email when walletless
const [domainArg, subjectArg] = process.argv.slice(2);
if (!domainArg || !subjectArg) {
    console.error(
        "Usage: bun scripts/genSetupCode.ts <domain> <wallet-or-email>"
    );
    process.exit(1);
}

const domain = new DnsCheckRepository().getNormalizedDomain(domainArg);
const setupCode = setupCodeFor(domain, subjectArg);

console.log(`Setup code for ${domain} and owner ${subjectArg}:`);
console.log(`- ${setupCode}`);
process.exit(0);
