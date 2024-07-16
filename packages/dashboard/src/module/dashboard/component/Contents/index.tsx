import { Panel } from "@/module/common/component/Panel";
import { ButtonAddProduct } from "@/module/dashboard/component/ButtonAddProduct";
import { ProductItem } from "@/module/dashboard/component/ProductItem";
import { useMyContents } from "@/module/dashboard/hooks/useMyContents";
import { Spinner } from "@module/component/Spinner";
import styles from "./index.module.css";

/**
 * Component to display all the current user content
 * @constructor
 */
export function MyContents() {
    const { isEmpty, contents, isPending } = useMyContents();

    if (isPending) {
        return <Spinner />;
    }

    if (isEmpty || !contents) {
        return <NoContents />;
    }

    return (
        <Panel variant={"ghost"} title={"My Products"}>
            <ContentListSection
                contents={[
                    ...(contents?.operator ?? []),
                    ...(contents?.owner ?? []),
                ]}
            />
        </Panel>
    );
}

function NoContents() {
    return (
        <div>
            You don't have any content yet.
            <ButtonAddProduct />
        </div>
    );
}

function ContentListSection({
    contents,
}: { contents: { id: bigint; name: string; domain: string }[] }) {
    return (
        <div className={styles.contentListSection}>
            <ButtonAddProduct />
            {contents.map((content) => (
                <ContentListItem key={content.id} content={content} />
            ))}
        </div>
    );
}

function ContentListItem({
    content,
}: { content: { id: bigint; name: string; domain: string } }) {
    return (
        <ProductItem>
            {content.name}
            <br />
            {content.domain}
        </ProductItem>
    );
}
