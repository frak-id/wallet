"use client";

import { useAddToHomeScreenPrompt } from "@/module/common/hook/useAddToHomeScreenPrompt";

/*
 * This lib can be nice to display a list of tokens on a wallet:
 *  - https://www.covalenthq.com/docs/unified-api/goldrush/kit/token-balances-list-view/
 */

export function WalletHomePage() {
    const { prompt, outcome, launchInstallation } = useAddToHomeScreenPrompt();
    return (
        <div>
            <h1>I'm logged in</h1>

            {prompt && (
                <button type={"button"} onClick={launchInstallation}>
                    Install the app
                </button>
            )}

            {prompt && (
                <div>
                    <p>plateforms: {JSON.stringify(prompt.platforms)}</p>
                    <p>Outcome: {outcome}</p>
                </div>
            )}
        </div>
    );
}
