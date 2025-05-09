import type {
    DisplayModalParamsType,
    FrakClient,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "../types";

/**
 * Function used to display a modal
 * @param client - The current Frak Client
 * @param args
 * @param args.steps - The different steps of the modal
 * @param args.metadata - The metadata for the modal (customization, etc)
 * @returns The result of each modal steps
 *
 * @description This function will display a modal to the user with the provided steps and metadata.
 *
 * @remarks
 * - The UI of the displayed modal can be configured with the `customCss` property in the `customizations.css` field of the top-level config.
 * - The `login` and `openSession` steps will be automatically skipped if the user is already logged in or has an active session. It's safe to include these steps in all cases to ensure proper user state.
 * - Steps are automatically reordered in the following sequence:
 *     1. `login` (if needed)
 *     2. `openSession` (if needed)
 *     3. All other steps in the order specified
 *     4. `success` (if included, always last)
 *
 * @example
 * Simple sharing modal with steps:
 *  1. Login (Skipped if already logged in)
 *  2. Open a session (Skipped if already opened)
 *  3. Display a success message with sharing link option
 *
 * ```ts
 * const results = await displayModal(frakConfig, {
 *     steps: {
 *         // Simple login with no SSO, nor customization
 *         login: { allowSso: false },
 *         // Simple session opening, with no customization
 *         openSession: {},
 *         // Success message
 *         final: {
 *             action: { key: "reward" },
 *             // Skip this step, it will be only displayed in the stepper within the modal
 *             autoSkip: true,
 *         },
 *     },
 * });
 *
 * console.log("Login step - wallet", results.login.wallet);
 * console.log("Open session step - start + end", {
 *     start: results.openSession.startTimestamp,
 *     end: results.openSession.endTimestamp,
 * });
 * ```
 *
 * @example
 * A full modal example, with a few customization options, with the steps:
 *  1. Login (Skipped if already logged in)
 *  2. Open a session (Skipped if already opened)
 *  3. Authenticate via SIWE
 *  4. Send a transaction
 *  5. Display a success message with sharing link options
 *
 * ```ts
 * const results = await displayModal(frakConfig, {
 *     steps: {
 *         // Login step
 *         login: {
 *             allowSso: true,
 *             ssoMetadata: {
 *                 logoUrl: "https://my-app.com/logo.png",
 *                 homepageLink: "https://my-app.com",
 *             },
 *         },
 *         // Simple session opening, with no customisation
 *         openSession: {},
 *         // Siwe authentication
 *         siweAuthenticate: {
 *             siwe: {
 *                 domain: "my-app.com",
 *                 uri: "https://my-app.com/",
 *                 nonce: generateSiweNonce(),
 *                 version: "1",
 *             },
 *         },
 *         // Send batched transaction
 *         sendTransaction: {
 *             tx: [
 *                 { to: "0xdeadbeef", data: "0xdeadbeef" },
 *                 { to: "0xdeadbeef", data: "0xdeadbeef" },
 *             ],
 *         },
 *         // Success message with sharing options
 *         final: {
 *             action: {
 *                 key: "sharing",
 *                 options: {
 *                     popupTitle: "Share the app",
 *                     text: "Discover my super app website",
 *                     link: "https://my-app.com",
 *                 },
 *             },
 *             dismissedMetadata: {
 *                 title: "Dismiss",
 *                 description: "You won't be rewarded for this sharing action",
 *             },
 *         },
 *     },
 *     metadata: {
 *         // Header of desktop modals
 *         header: {
 *             title: "My-App",
 *             icon: "https://my-app.com/logo.png",
 *         },
 *         // Context that will be present in every modal steps
 *         context: "My-app overkill flow",
 *     },
 * });
 * ```
 */
export async function displayModal<
    T extends ModalStepTypes[] = ModalStepTypes[],
>(
    client: FrakClient,
    { steps, metadata }: DisplayModalParamsType<T>
): Promise<ModalRpcStepsResultType<T>> {
    return (await client.request({
        method: "frak_displayModal",
        params: [steps, metadata, client.config.metadata],
    })) as ModalRpcStepsResultType<T>;
}
