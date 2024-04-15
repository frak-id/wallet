import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { useIsCommunityTokenMintAvailable } from "@/module/community-token/hooks/useIsCommunityTokenMintAvailable";
import { useMintCommunityToken } from "@/module/community-token/hooks/useMintCommunityToken";
import styles from "./index.module.css";

export function ButtonMintCommunity({
    name,
    image,
    contentId,
}: { name: string; image: string; contentId: number }) {
    const { data: isMintAvailable } = useIsCommunityTokenMintAvailable({
        contentId,
    });
    const { mutateAsync: mintToken, isPending } = useMintCommunityToken({
        contentId,
    });

    // If mint not available early exit
    if (!isMintAvailable) {
        return null;
    }

    return (
        <ButtonRipple
            className={styles.buttonMintCommunity}
            onClick={async () => {
                await mintToken();
            }}
            isLoading={isPending}
            disabled={isPending || !isMintAvailable}
        >
            <img
                src={`/images/${image}`}
                alt={name}
                width={30}
                height={30}
                className={styles.buttonMintCommunity__image}
            />
            <span>
                Join <strong>{name}</strong> community
            </span>
        </ButtonRipple>
    );
}
