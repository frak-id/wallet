import { ListenerUI } from "@/module/listener/component";
import Script from "next/script";

export default function ListenerPage() {
    return (
        <>
            <ListenerUI />
            <Script id="theme" strategy="afterInteractive">
                {`
                    document.querySelector(":root").dataset.theme = "dark";
                `}
            </Script>
        </>
    );
}
