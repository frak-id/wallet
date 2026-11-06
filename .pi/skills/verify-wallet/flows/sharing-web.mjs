// sharing-web: a plain web visit to the standalone /sharing page renders the merchant reward and opens an FAQ answer.
const MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000"; // tests-light/mocks/api.ts MERCHANT_ID

export default async ({ page, url, step, expect }) => {
    const query = new URLSearchParams({
        merchantId: MERCHANT_ID,
        link: "https://acme.example.com",
    });
    await page.goto(`${url}/sharing?${query}`, { waitUntil: "commit" });
    const dialog = page.getByRole("dialog");
    await expect(
        dialog.getByRole("heading", { name: "Share with your friends" })
    ).toBeVisible();
    await expect(dialog.getByText(/Earn 12\s*€/)).toBeVisible();
    await step("sharing");

    const faq = dialog.getByRole("button", { name: "How much can I earn?" });
    await faq.click();
    await expect(faq).toHaveAttribute("aria-expanded", "true");
    await step("faq-open");
};
