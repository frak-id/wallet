import { useSettings } from "@shopify/ui-extensions/checkout/preact";
import { render } from "preact";
import { PostPurchaseCard } from "./PostPurchaseCard";

function ThankYouExtension() {
    const settings = useSettings();
    return <PostPurchaseCard settings={settings} />;
}

export default function extension() {
    render(<ThankYouExtension />, document.body);
}
