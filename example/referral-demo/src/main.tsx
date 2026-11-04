import "@frak-labs/design-system/global";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { registerServiceWorker } from "@/shell/pwa";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>
);

registerServiceWorker();
