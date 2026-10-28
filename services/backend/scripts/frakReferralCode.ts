import { OrchestrationContext } from "../src/orchestration/context";
import { HttpError } from "../src/utils/httpError";

const USAGE = `Usage: bun scripts/frakReferralCode.ts <command>
  issue [CODE]   issue a Frak code, vanity when CODE is given, random otherwise
  revoke <CODE>  stop new redemptions; existing referees keep Frak as referrer
  list           every Frak code
Also on the business dashboard, under Internal > Referral codes.`;

const codes = OrchestrationContext.orchestrators.frakCodeAdmin;

// All uppercase so the QR encoder can use its denser alphanumeric mode.
function qrUrl(code: string): string {
    const walletUrl = process.env.FRAK_WALLET_URL ?? "https://wallet.frak.id";
    return `${walletUrl}/r/${code}`.toUpperCase();
}

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

async function issue(raw: string | undefined) {
    const created = await codes.issue(raw);
    console.log(`Issued Frak referral code ${created.code}`);
    console.log(`QR link: ${qrUrl(created.code)}`);
}

async function revoke(raw: string | undefined) {
    if (!raw) fail(USAGE);
    const revoked = await codes.revoke(raw);
    console.log(`Revoked Frak referral code ${revoked.code}`);
}

async function list() {
    console.table(
        (await codes.list()).map((code) => ({
            code: code.code,
            qrUrl: qrUrl(code.code),
            createdAt: code.createdAt.toISOString(),
            revokedAt: code.revokedAt?.toISOString() ?? "",
            redemptions: code.redemptions,
            activeReferees: code.activeReferees,
            game: code.gameId ?? "",
        }))
    );
}

const [command, arg] = process.argv.slice(2);
try {
    if (command === "issue") await issue(arg);
    else if (command === "revoke") await revoke(arg);
    else if (command === "list") await list();
    else fail(USAGE);
} catch (error) {
    if (error instanceof HttpError) fail(error.message);
    throw error;
}
process.exit(0);
