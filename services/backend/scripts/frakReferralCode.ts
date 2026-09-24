import { IdentityContext } from "../src/domain/identity/context";
import {
    FRAK_REFERRAL_IDENTITY_GROUP_ID,
    ReferralCodeContext,
} from "../src/domain/referral-code";
import { CODE_LENGTH, generateCandidates, STEM_ALPHABET } from "../src/utils";

const USAGE = `Usage: bun scripts/frakReferralCode.ts <command>
  issue [CODE]   issue a Frak code, vanity when CODE is given, random otherwise
  revoke <CODE>  stop new redemptions; existing referees keep Frak as referrer
  list           every Frak code`;

const referralCodes = ReferralCodeContext.repositories.referralCode;

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

function parseVanityCode(raw: string): string {
    const code = raw.toUpperCase();
    if (code.length !== CODE_LENGTH) {
        fail(`Code must be exactly ${CODE_LENGTH} characters: ${raw}`);
    }
    const invalid = [...code].find((ch) => !STEM_ALPHABET.includes(ch));
    if (invalid) fail(`Code contains an invalid character: ${invalid}`);
    return code;
}

async function issue(raw: string | undefined) {
    await IdentityContext.repositories.identity.ensureGroup(
        FRAK_REFERRAL_IDENTITY_GROUP_ID
    );

    const candidates = raw ? [parseVanityCode(raw)] : generateCandidates();
    for (const candidate of candidates) {
        const created = await referralCodes.createFrakCode(candidate);
        if (created) {
            console.log(`Issued Frak referral code ${created.code}`);
            return;
        }
    }
    fail(raw ? `Code ${raw.toUpperCase()} is already taken` : "No free code");
}

async function revoke(raw: string | undefined) {
    if (!raw) fail(USAGE);
    const revoked = await referralCodes.revokeFrakCode(raw);
    if (!revoked) fail(`No active Frak code ${raw.toUpperCase()}`);
    console.log(`Revoked Frak referral code ${revoked.code}`);
}

async function list() {
    const codes = await referralCodes.listFrakCodes();
    console.table(
        codes.map((code) => ({
            code: code.code,
            createdAt: code.createdAt.toISOString(),
            revokedAt: code.revokedAt?.toISOString() ?? "",
        }))
    );
}

const [command, arg] = process.argv.slice(2);
switch (command) {
    case "issue":
        await issue(arg);
        break;
    case "revoke":
        await revoke(arg);
        break;
    case "list":
        await list();
        break;
    default:
        fail(USAGE);
}
process.exit(0);
