import { createFileRoute } from "@tanstack/react-router";
import { ConnectedDevicesPage } from "@/module/settings/component/ConnectedDevicesPage";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/devices"
)({
    component: ConnectedDevicesPage,
});
