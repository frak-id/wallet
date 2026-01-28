import type { GetMerchantInformationReturnType } from "@frak-labs/core-sdk";
import { useGetMerchantInformation } from "@frak-labs/react-sdk";
import { Panel } from "@/module/common/component/Panel";

export function ProductInfo() {
    const {
        data: productInformation,
        error,
        status,
    } = useGetMerchantInformation();

    return (
        <Panel variant={"primary"}>
            <h2>Product information</h2>

            <p>
                <b>Status:</b>
                {status}
            </p>

            <InnerStatus info={productInformation} />

            {error && <div>Error: {JSON.stringify(error)}</div>}
        </Panel>
    );
}

function InnerStatus({
    info,
}: {
    info?: Readonly<GetMerchantInformationReturnType>;
}) {
    if (!info?.onChainMetadata) {
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
            </div>
            <h4>Active reward</h4>
            <div>
                <b>Estimated eur reward per interaction:</b>{" "}
                {info.maxReferrer?.eurAmount ?? "N/A"}
            </div>
        </div>
    );
}
