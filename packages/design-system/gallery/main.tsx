import "@frak-labs/design-system/global";
import { TooltipProvider } from "@frak-labs/design-system/components/Tooltip";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Gallery } from "./Gallery";
import "./gallery.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
    <StrictMode>
        <TooltipProvider>
            <Gallery />
        </TooltipProvider>
    </StrictMode>
);
