import { BillingContext } from "../src/domain/billing/context";
import type { BillingDocumentKind } from "../src/domain/billing/schemas";
import { OrchestrationContext } from "../src/orchestration/context";

/**
 * Re-renders already-issued billing PDFs (deposit notes, withdraw notes,
 * monthly bills) with the current template, overwriting each stored object in
 * place. Amounts, references and dates come from the frozen rows and no
 * database column is written; no email is sent. See
 * `docs/runbooks/rerender-billing-pdfs.md`.
 *
 *   bun run scripts/rerenderBillingPdfs.ts [--apply] [--kind=deposit|withdraw|monthly_bill]
 *                                          [--merchant=<uuid>] [--id=<uuid>]
 *
 * Dry run by default: lists what would be re-rendered and touches nothing.
 */
const KINDS: BillingDocumentKind[] = ["deposit", "withdraw", "monthly_bill"];

const flags = new Map(
    process.argv.slice(2).map((arg) => {
        const [name, value] = arg.replace(/^--/, "").split("=");
        return [name, value ?? "true"] as const;
    })
);
const apply = flags.get("apply") === "true";
const kind = flags.get("kind") as BillingDocumentKind | undefined;
if (kind && !KINDS.includes(kind)) {
    console.error(`Invalid --kind: ${kind} (expected ${KINDS.join("|")})`);
    process.exit(1);
}

const documents =
    await BillingContext.repositories.billingDocument.listWithStoredPdf({
        merchantId: flags.get("merchant"),
        kind,
        id: flags.get("id"),
    });

console.log(
    `${apply ? "APPLY" : "DRY RUN"}: ${documents.length} stored PDF(s) selected`
);

const { billing, monthlyBill } = OrchestrationContext.orchestrators;
let rendered = 0;
let failed = 0;
for (const document of documents) {
    const label = `${document.reference} (${document.kind}, ${document.id})`;
    if (!apply) {
        console.log(`would re-render ${label}`);
        continue;
    }
    try {
        const key =
            document.kind === "monthly_bill"
                ? await monthlyBill.rerenderIssuedPdf(document)
                : await billing.rerenderIssuedPdf(document);
        if (key) {
            rendered += 1;
            console.log(`re-rendered ${label} -> ${key}`);
        } else {
            console.log(`skipped ${label} (nothing to render)`);
        }
    } catch (err) {
        failed += 1;
        console.error(`FAILED ${label}:`, err);
    }
}

if (apply) console.log(`done: ${rendered} re-rendered, ${failed} failed`);
else console.log("dry run only - pass --apply to re-render");
process.exit(failed > 0 ? 1 : 0);
