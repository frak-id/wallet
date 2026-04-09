import {
    useAttributeValues,
    useSettings,
} from "@shopify/ui-extensions/customer-account/preact";
import { render } from "preact";
import { PostPurchaseCard } from "./PostPurchaseCard";

function OrderStatusExtension() {
    const settings = useSettings();
    const [clientId] = useAttributeValues(["_frak-client-id"]);

    return <PostPurchaseCard settings={settings} clientId={clientId} />;
}

export default function extension() {
    render(<OrderStatusExtension />, document.body);
}
