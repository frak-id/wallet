import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { Beaker } from "lucide-react";
import { useAccount } from "wagmi";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useMoneriumOnchainSign } from "@/module/monerium/hooks/useMoneriumOnchainSign";

export function MoneriumOnchainLink() {
    const { address } = useAccount();
    const { signOnchain, isPending, error } = useMoneriumOnchainSign();

    if (!address) return null;

    return (
        <Panel size={"small"}>
            <Title icon={<Beaker size={32} />}>
                Monerium Onchain Sign (Experiment)
            </Title>

            <p>
                Sign onchain to link wallet with Monerium. Two methods to test
                which SignMsg format is accepted.
            </p>

            {error && (
                <p style={{ color: "red" }}>
                    {error instanceof Error ? error.message : "Signing failed"}
                </p>
            )}

            <div
                style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                }}
            >
                <Button
                    size={"small"}
                    disabled={isPending}
                    leftIcon={isPending ? <Spinner /> : undefined}
                    onClick={() => signOnchain({ method: "signMessage" })}
                >
                    signMessage (structured hash)
                </Button>
                <Button
                    size={"small"}
                    variant={"outline"}
                    disabled={isPending}
                    leftIcon={isPending ? <Spinner /> : undefined}
                    onClick={() => signOnchain({ method: "signMessageRaw" })}
                >
                    signMessageRaw (raw hash)
                </Button>
            </div>
        </Panel>
    );
}
