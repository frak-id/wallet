import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { useIsCommunityTokenMintAvailable } from "@/module/community-token/hooks/useIsCommunityTokenMintAvailable";
import { useMintCommunityToken } from "@/module/community-token/hooks/useMintCommunityToken";
import styles from "./index.module.css";

export function ButtonMintCommunity({
    name,
    image,
    contentId,
}: { name: string; image: string; contentId: number }) {
    const { data: isMintAvailable, isLoading } =
        useIsCommunityTokenMintAvailable({
            contentId,
        });
    const { mutateAsync: mintToken, isPending } = useMintCommunityToken({
        contentId,
    });

    return (
        <ButtonRipple
            className={styles.buttonMintCommunity}
            onClick={async () => {
                await mintToken();
            }}
            isLoading={isLoading || isPending}
            disabled={isLoading || isPending || !isMintAvailable}
        >
            <img
                src={`/images/${image}`}
                alt={name}
                width={30}
                height={30}
                className={styles.buttonMintCommunity__image}
            />
            <span>
                {isMintAvailable ? (
                    <>
                        Join <strong>{name}</strong> community
                    </>
                ) : (
                    <>
                        You are already in <strong>{name}</strong> community
                    </>
                )}
            </span>
        </ButtonRipple>
    );
}
