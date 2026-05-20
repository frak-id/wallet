import { Box } from "@frak-labs/design-system/components/Box";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export function Breadcrumb({ current }: { current: string }) {
    return (
        <Box
            as="span"
            display="flex"
            alignItems="center"
            gap="xs"
            color="tertiary"
        >
            <Link to="/dashboard">Dashboard</Link>
            <ChevronRight size={18} />
            {current}
        </Box>
    );
}
