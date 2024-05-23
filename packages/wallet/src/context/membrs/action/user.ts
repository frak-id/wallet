"use server";

import type { UserDocument } from "@/context/membrs/dto/UserDocument";
import { getUserRepository } from "@/context/membrs/repository/UserRepository";
import type { Hex } from "viem";

export async function getUser({ id }: { id?: Hex }) {
    if (!id) {
        return null;
    }
    const userRepository = await getUserRepository();
    return await userRepository.getById(id);
}

export async function saveUser({ _id, username, photo }: UserDocument) {
    const userRepository = await getUserRepository();
    return await userRepository.createOrUpdate({ _id, username, photo });
}
