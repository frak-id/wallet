import { createFileRoute } from "@tanstack/react-router";
import { ConnectedDevicesPage } from "@/module/settings/component/ConnectedDevicesPage";

export const Route = createFileRoute("/_wallet/_protected/profile/devices")({
    component: ConnectedDevicesPage,
});
