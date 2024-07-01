"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { getClient } from "@/context/indexer/client";
import { gql } from "@urql/core";
import type { Address } from "viem";

/**
 * Get the content for a given admnistrator query
 */
const QUERY = gql(`
query GetContentFromAdministrator($wallet: String!) {
  contentAdministrators(
    limit: 10
    where: {user: $wallet}
  ) {
    items {
      isOwner
      content {
        id
        domain
        name
        contentTypes
      }
    }
  }
 }
`);

type QueryResult = {
    contentAdministrators: {
        items: {
            isOwner: boolean;
            content: {
                id: string;
                domain: string;
                name: string;
                contentTypes: string;
            };
        }[];
    };
};

type GetContentsResult = {
    owner: { id: bigint; name: string; domain: string }[];
    operator: { id: bigint; name: string; domain: string }[];
};

/**
 * Get all the user contents
 * todo: should have a caching layer
 */
export async function getContents({ wallet }: { wallet: Address }) {
    // Get our indexer result
    const result = await getClient()
        .query<QueryResult>(QUERY, { wallet: wallet })
        .toPromise();
    // Map it to the form: { owner: [contents], operator: [contents] }
    return (
        result.data?.contentAdministrators.items.reduce(
            (
                acc: GetContentsResult,
                item: QueryResult["contentAdministrators"]["items"][number]
            ) => {
                // Map our content
                const mappedContent = {
                    id: BigInt(item.content.id),
                    name: item.content.name,
                    domain: item.content.domain,
                };

                // Push it in the right list
                if (item.isOwner) {
                    acc.owner.push(mappedContent);
                } else {
                    acc.operator.push(mappedContent);
                }
                return acc;
            },
            { owner: [], operator: [] }
        ) ?? { owner: [], operator: [] }
    );
}

/**
 * Get the contents for the current user
 */
export async function getMyContents() {
    const session = await getSafeSession();
    return getContents({ wallet: session.wallet });
}
