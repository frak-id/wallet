import { useState } from "react";

type ImageRemoteProps = {
    image: string;
    width: number;
    height: number;
    title: string;
    className?: string;
};

export function ImageRemote({
    image,
    width,
    height,
    title,
    className = "",
}: ImageRemoteProps) {
    const [isImageLoaded, setIsImageLoaded] = useState(true);
    return (
        image &&
        isImageLoaded && (
            <img
                src={image}
                alt={title}
                className={className}
                onLoad={(event) => {
                    const target = event.target as HTMLImageElement;
                    if (target.naturalWidth === 0) {
                        setIsImageLoaded(false);
                    }
                }}
                onError={() => {
                    setIsImageLoaded(false);
                }}
                sizes="100vw"
                width={width}
                height={height}
            />
        )
    );
}
