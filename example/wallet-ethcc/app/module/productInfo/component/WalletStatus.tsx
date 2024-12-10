import { Panel } from "@/module/common/component/Panel";
import type { GetProductInformationReturnType } from "@frak-labs/nexus-sdk/core";
import { useGetProductInformation } from "@frak-labs/nexus-sdk/react";

export function ProductInfo() {
    const { data: productInformation, error, status } = useGetProductInformation();

    return (
        <Panel variant={"primary"}>
            <h2>Product information</h2>

            <p><b>Status:</b>{status}</p>

            <InnerStatus info={productInformation} />

            {error && <div>Error: {JSON.stringify(error)}</div>}
        </Panel>
    );
}

function InnerStatus({
    info,
}: {
    info?: Readonly<GetProductInformationReturnType>;
}) {
    if (!info) {
        return null;
    }

    return (
        <div>
            <div>
                <b>Product ID:</b> {info.id}
            </div>
            <h4>On Chain metadata</h4>
            <div>
                <p>
                    <b>Name:</b> {info.onChainMetadata.name}
                </p>
                <p>
                    <b>Domain:</b> {info.onChainMetadata.domain}
                </p>
                <p>
                    <b>Types:</b> {info.onChainMetadata.productTypes.join(", ")}
                </p>
            </div>
            <h4>Active reward</h4>
            <div>
                <b>Estimated eur reward per interaction:</b>{" "}
                {info.estimatedEurReward ?? "N/A"}
            </div>
        </div>
    );
}
