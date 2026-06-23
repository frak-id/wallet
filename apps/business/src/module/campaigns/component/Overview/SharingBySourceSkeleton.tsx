import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";

export function SharingBySourceSkeleton() {
    return (
        <Card radius="m">
            <Stack space="m">
                <Inline space="xs">
                    <Skeleton variant="rect" width={88} height={32} />
                    <Skeleton variant="rect" width={88} height={32} />
                </Inline>
                <Skeleton variant="text" width="50%" height={14} />
                <Inline space="m" align="center">
                    <Skeleton variant="circle" width={140} height={140} />
                </Inline>
                <Inline space="l" align="center">
                    <Skeleton variant="text" width={72} height={12} />
                    <Skeleton variant="text" width={72} height={12} />
                    <Skeleton variant="text" width={72} height={12} />
                </Inline>
            </Stack>
        </Card>
    );
}
