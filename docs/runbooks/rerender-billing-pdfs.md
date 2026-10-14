# Re-render already-issued billing PDFs

Deposit notes, withdraw notes and monthly bills are **stored PDFs**, not generated per request. The first
download renders the PDF, uploads it to the private `billing-<stage>` bucket (`{merchantId}/{kind}/{id}.pdf`)
and the row keeps `pdf_storage_key` / `pdf_generated_at`; the download route only streams the stored object.
A template change therefore applies to new documents only. Documents issued before it keep their old layout until
this script overwrites the stored object.

Run it **once per environment after the template change is deployed** (dev first, then production), by an operator
with the backend env (`bun run dev:env` / `sst shell`) and bucket credentials.

```bash
cd services/backend

# 1. Dry run (default): lists the documents, renders and writes nothing.
bun run scripts/rerenderBillingPdfs.ts

# 2. Narrow down if wanted: --kind=deposit|withdraw|monthly_bill  --merchant=<uuid>  --id=<document uuid>
bun run scripts/rerenderBillingPdfs.ts --kind=deposit --apply

# 3. Everything
bun run scripts/rerenderBillingPdfs.ts --apply
```

## What it does and does not touch

- Selects non-voided documents that have a stored PDF, oldest first.
- Re-renders each one from its frozen row (`gross_amount`, `net_amount`, `details`) with the current template and
  overwrites the object at the same key. Reference, amounts, dates, `pdf_storage_key` and `pdf_generated_at` are
  **not** modified; no database column is written.
- Monthly bills: the ledgers and totals come from the frozen `details`. Only the reward annex rows (and the merchant
  buyer block) are re-read, exactly as at the original render, so a bill whose rewards changed after issuing shows the
  current rows. Compare with a dry run if that matters for a given bill.
- Deposit/withdraw buyer block comes from the merchant's current accounting info, as it did at first render.
- Sends no email and no notification. Idempotent: re-running yields the same PDFs.
- Documents without a stored PDF are not listed: they render with the new template on first download.
- A failure on one document is logged and the run continues; the exit code is 1 if any failed.

Previews of the three layouts with fake data: `docs/previews/` (regenerate with
`bun run --cwd services/backend previews:billing`).
