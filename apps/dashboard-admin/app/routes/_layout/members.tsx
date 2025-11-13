import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/members")({
    component: MembersComponent,
});

function MembersComponent() {
    return (
        <div className="p-4">
            <p>Members listing will appear here</p>
        </div>
    );
}
