export function originTopic(pairingId: string) {
    return `pairing:${pairingId}:origin`;
}

export function targetTopic(pairingId: string) {
    return `pairing:${pairingId}:target`;
}
