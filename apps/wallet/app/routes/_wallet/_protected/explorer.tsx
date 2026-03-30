import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/explorer")({
    component: ExplorerPage,
});

function ExplorerPage() {
    return (
        <Box display="flex" flexDirection="column" gap="m">
            <Text as="h1">Explorer</Text>
        </Box>
    );
}
