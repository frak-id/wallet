import { Box } from "@frak-labs/design-system/components/Box";
import { createFileRoute } from "@tanstack/react-router";
import { Title } from "@/module/common/component/Title";

export const Route = createFileRoute("/_wallet/_protected/explorer")({
    component: ExplorerPage,
});

function ExplorerPage() {
    return (
        <Box display="flex" flexDirection="column" gap="m">
            <Title size="page">Explorer</Title>
        </Box>
    );
}
