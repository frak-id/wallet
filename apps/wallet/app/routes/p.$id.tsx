import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compact pairing alias used by the QR code to keep the encoded payload short
 * (and uppercase, which lets the QR encoder pick the alphanumeric mode).
 *
 * Redirects to the canonical `/pairing?id=<lowercase>` route — case-folding
 * the id here keeps every backend lookup site (which is byte-exact on a
 * `varchar` column) on a single canonical form.
 */
export const Route = createFileRoute("/p/$id")({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: "/pairing",
            search: { id: params.id.toLowerCase(), mode: undefined },
            replace: true,
        });
    },
});
