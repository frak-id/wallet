import { useMyContents } from "@/module/dashboard/hooks/useMyContents";
import { ButtonRipple } from "@frak-labs/nexus-wallet/src/module/common/component/ButtonRipple";

/**
 * Component to display all the current user content
 * @constructor
 */
export function MyContents() {
    const { isEmpty, contents } = useMyContents();

    if (isEmpty) {
        return <NoContents />;
    }

    return (
        <>
            <h3>Owned contents</h3>
            <ContentListSection contents={contents.owner} />

            <h3>Operated contents</h3>
            <ContentListSection contents={contents.operator} />
        </>
    );
}

function NoContents() {
    return (
        <div>
            You don't have any content yet.
            <ButtonRipple>Register one</ButtonRipple>
        </div>
    );
}

function ContentListSection({
    contents,
}: { contents: { id: bigint; name: string; domain: string }[] }) {
    return (
        <div>
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
        <div>
            {content.name}: {content.domain}
        </div>
    );
}
