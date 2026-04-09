import {
    useAttributeValues,
    useSettings,
} from "@shopify/ui-extensions/checkout/preact";
import { render } from "preact";
import { PostPurchaseCard } from "./PostPurchaseCard";

function ThankYouExtension() {
    const settings = useSettings();
    const [clientId] = useAttributeValues(["_frak-client-id"]);

    return <PostPurchaseCard settings={settings} clientId={clientId} />;
}

export default function extension() {
    render(<ThankYouExtension />, document.body);
}
