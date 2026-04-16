import { useOpenSso, usePrepareSso } from "@frak-labs/react-sdk";
import { Button } from "@/module/common/component/Button";
import { Panel } from "@/module/common/component/Panel";

export function Sso() {
    const { data: ssoLink } = usePrepareSso({ metadata: {}, directExit: true });
    const { data, status, error, mutate } = useOpenSso();

    return (
        <Panel>
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

            <Button
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
            </Button>

            <Button
                onClick={() => {
                    mutate({
                        openInSameWindow: false,
                        ssoPopupUrl: ssoLink?.ssoUrl ?? "",
                    });
                }}
            >
                Distant window
            </Button>
        </Panel>
    );
}
