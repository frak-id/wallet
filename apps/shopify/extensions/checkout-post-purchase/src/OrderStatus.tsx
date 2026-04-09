import { useSettings } from "@shopify/ui-extensions/customer-account/preact";
import { render } from "preact";
import { PostPurchaseCard } from "./PostPurchaseCard";

function OrderStatusExtension() {
    const settings = useSettings();
    return <PostPurchaseCard settings={settings} />;
}

export default function extension() {
    render(<OrderStatusExtension />, document.body);
}
