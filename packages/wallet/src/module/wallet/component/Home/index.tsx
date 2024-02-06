"use client";

import { useAddToHomeScreenPrompt } from "@/module/common/hook/useAddToHomeScreenPrompt";

export function WalletHomePage() {
    const { prompt, outcome, launchInstallation } = useAddToHomeScreenPrompt();

    return (
        <div>
            <h1>I'm logged in</h1>

            <p>
                {prompt && (
                    <button type={"button"} onClick={launchInstallation}>
                        Install the app
                    </button>
                )}
            </p>

            <p>
                {prompt && (
                    <div>
                        <p>plateforms: {JSON.stringify(prompt.platforms)}</p>
                        <p>Outcome: {outcome}</p>
                    </div>
                )}
            </p>
        </div>
    );
}
