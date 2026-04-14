type GiftIconProps = {
    className?: string;
    width?: number;
    height?: number;
};

/**
 * Gift icon used in Banner and PostPurchase previews (matches SDK component icon)
 */
export function GiftIcon({
    className,
    width = 40,
    height = 40,
}: GiftIconProps) {
    return (
        <svg
            className={className}
            width={width}
            height={height}
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M33.333 16.667H6.667V13.333H12.083C11.05 12.483 10.333 11.25 10.333 9.833C10.333 7.267 12.433 5.167 15 5.167C17.083 5.167 18.75 6.5 19.583 8.25L20 9.167L20.417 8.25C21.25 6.5 22.917 5.167 25 5.167C27.567 5.167 29.667 7.267 29.667 9.833C29.667 11.25 28.95 12.483 27.917 13.333H33.333V16.667ZM25 8.5C24.267 8.5 23.667 9.1 23.667 9.833C23.667 10.567 24.267 11.167 25 11.167C25.733 11.167 26.333 10.567 26.333 9.833C26.333 9.1 25.733 8.5 25 8.5ZM15 8.5C14.267 8.5 13.667 9.1 13.667 9.833C13.667 10.567 14.267 11.167 15 11.167C15.733 11.167 16.333 10.567 16.333 9.833C16.333 9.1 15.733 8.5 15 8.5ZM6.667 18.333H18.333V35H8.333C7.413 35 6.667 34.254 6.667 33.333V18.333ZM21.667 35V18.333H33.333V33.333C33.333 34.254 32.587 35 31.667 35H21.667Z"
                fill="currentColor"
            />
        </svg>
    );
}
