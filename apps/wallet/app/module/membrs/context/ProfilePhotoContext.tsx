import {
    createContext,
    type PropsWithChildren,
    useContext,
    useMemo,
    useState,
} from "react";

type ProfilePhotoContextValue = {
    uploadedPhoto: string | undefined;
    setUploadedPhoto: (photo: string | undefined) => void;
    clearUploadedPhoto: () => void;
};

const ProfilePhotoContext = createContext<ProfilePhotoContextValue | null>(
    null
);

export function ProfilePhotoProvider({ children }: PropsWithChildren) {
    const [uploadedPhoto, setUploadedPhoto] = useState<string | undefined>();

    const value = useMemo(
        () => ({
            uploadedPhoto,
            setUploadedPhoto,
            clearUploadedPhoto: () => setUploadedPhoto(undefined),
        }),
        [uploadedPhoto]
    );

    return (
        <ProfilePhotoContext.Provider value={value}>
            {children}
        </ProfilePhotoContext.Provider>
    );
}

export function useProfilePhoto() {
    const context = useContext(ProfilePhotoContext);
    if (!context) {
        throw new Error(
            "useProfilePhoto must be used within ProfilePhotoProvider"
        );
    }
    return context;
}
