"use client";

import { Panel } from "@/module/common/component/Panel";
import { selectedMembersAtom } from "@/module/members/atoms/selectedMembers";
import { Button } from "@module/component/Button";
import { useAtomValue } from "jotai";
import { useSetAtom } from "jotai/index";
import type { Address } from "viem";

/**
 * Audience panel
 * @constructor
 */
export function AudiencePanel() {
    const selectedMembers = useAtomValue(selectedMembersAtom);

    return (
        <Panel title={"Audience"}>
            {selectedMembers?.length && (
                <PreSelectedMembers members={selectedMembers} />
            )}
            {!selectedMembers?.length && <SelectAudience />}
        </Panel>
    );
}

function PreSelectedMembers({ members }: { members: Address[] }) {
    const setSelectedMembers = useSetAtom(selectedMembersAtom);

    return (
        <>
            <p>
                You have selected <strong>{members.length}</strong> members to
                receive the notification
            </p>

            <Button
                onClick={() => setSelectedMembers(undefined)}
                variant={"danger"}
            >
                Clear selected members
            </Button>
        </>
    );
}

function SelectAudience() {
    return (
        <>
            <p>Super audiance form</p>
        </>
    );
}
