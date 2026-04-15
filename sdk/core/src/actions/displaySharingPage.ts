import type {
    DisplaySharingPageParamsType,
    DisplaySharingPageResultType,
    FrakClient,
} from "../types";

/**
 * Function used to display a sharing page
 * @param client - The current Frak Client
 * @param params - The parameters to customize the sharing page (products, link override, metadata)
 * @param placement - Optional placement ID to associate with this display request
 * @returns The result indicating the user's action (shared, copied, or dismissed)
 *
 * @description This function will display a full-page sharing UI to the user,
 * showing product info, estimated rewards, sharing steps, FAQ, and share/copy buttons.
 * The sharing link is generated from the user's wallet context + merchant info.
 *
 * @remarks
 * - The promise resolves on the first user action (share or copy) but the page stays visible
 * - The user can continue to share/copy multiple times after the initial resolution
 * - Dismissing the page after a share/copy action is a no-op (promise already resolved)
 * - If the user dismisses without any action, the promise resolves with `{ action: "dismissed" }`
 *
 * @example
 * ```ts
 * const result = await displaySharingPage(frakClient, {
 *     products: [
 *         {
 *             title: "Babies camel cuir velours bout carré",
 *             imageUrl: "https://example.com/product.jpg",
 *         },
 *     ],
 * });
 *
 * console.log("User action:", result.action); // "shared" | "copied" | "dismissed"
 * ```
 */
export async function displaySharingPage(
    client: FrakClient,
    params: DisplaySharingPageParamsType,
    placement?: string
): Promise<DisplaySharingPageResultType> {
    return await client.request({
        method: "frak_displaySharingPage",
        params: placement
            ? [params, client.config.metadata, placement]
            : [params, client.config.metadata],
    });
}
