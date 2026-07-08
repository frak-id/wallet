/**
 * Thin re-export shim: `BillingPdfService` was split into `./pdf/*` (shared
 * primitives/chrome + one engine per document kind — deposit/withdraw/monthly
 * bill) to keep each piece small and independently editable. Kept at this
 * path so existing imports (`./services/BillingPdfService`) keep resolving
 * unchanged.
 */
export { BillingPdfService } from "./pdf";
export { sanitizeForWinAnsi } from "./pdf/primitives";
export type { BillingPdfDocumentDto } from "./pdf/types";
