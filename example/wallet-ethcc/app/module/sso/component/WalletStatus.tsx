import { Panel } from "@/module/common/component/Panel";
import { useOpenSso } from "@frak-labs/react-sdk";

export function Sso() {
    const { data, status, error, mutate } = useOpenSso();

    return (
        <Panel variant={"primary"}>
            <h2>SSO</h2>

            <p>
                <b>Status:</b>
                {status}
            </p>

            <p>
                <b>Wallet:</b>
                {data?.wallet}
            </p>

            {error && <div>Error: {JSON.stringify(error)}</div>}

            <button
                type="button"
                onClick={() => {
                    mutate({
                        redirectUrl: window.location.href,
                        directExit: true,
                        openInSameWindow: true,
                        metadata: {},
                    });
                }}
            >
                With redirect
            </button>

            <button
                type="button"
                onClick={() => {
                    mutate({
                        directExit: true,
                        openInSameWindow: false,
                        metadata: {},
                    });
                }}
            >
                Distant window
            </button>
        </Panel>
    );
}
