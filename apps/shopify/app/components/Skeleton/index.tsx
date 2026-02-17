import { SkeletonBodyText } from "app/components/ui/SkeletonBodyText";
import { SkeletonPage } from "app/components/ui/SkeletonPage";

export function Skeleton() {
    return (
        <SkeletonPage>
            <s-section>
                <SkeletonBodyText lines={5} />
            </s-section>
        </SkeletonPage>
    );
}
