import Image from "next/image";
import { useState } from "react";

type ImageRemoteProps = {
    image: string;
    width: number;
    height: number;
    title: string;
    className?: string;
    priority?: boolean;
};

export function ImageRemote({
    image,
    width,
    height,
    title,
    priority = false,
    className = "",
}: ImageRemoteProps) {
    const [isImageLoaded, setIsImageLoaded] = useState(true);
    return (
        image &&
        isImageLoaded && (
            <Image
                priority={priority}
                src={image}
                alt={title}
                className={className}
                onLoad={(event) => {
                    if (event.target.naturalWidth === 0) {
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
