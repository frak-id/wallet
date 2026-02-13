import { RouterProvider } from "@tanstack/react-router";
import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { getRouter } from "./router";

const router = getRouter();

declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof getRouter>;
    }
}

async function main() {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
        throw new Error("Root element not found");
    }

    startTransition(() => {
        const root = createRoot(rootElement);
        root.render(
            <StrictMode>
                <RouterProvider router={router} />
            </StrictMode>
        );
    });
}

main().catch((error) => console.error(error));
