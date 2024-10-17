import { ListenerUI } from "@/module/listener/component";
import Script from "next/script";

export default function ListenerPage() {
    return (
        <>
            <ListenerUI />
            {/*<Script id="theme" strategy="afterInteractive">
                {`
                    document.querySelector(":root").dataset.theme = "dark";
                `}
            </Script>*/}
            <Script id="storageAccessCheck" strategy="beforeInteractive">
                {`
                    window.FrakStorageCheck = {};
                    // Check storage access on load, and place a meta tag with the result
                    document.hasStorageAccess().then((hasAccess) => {
                        FrakStorageCheck.hasAccess = hasAccess;
                    });
                `}
            </Script>
        </>
    );
}
