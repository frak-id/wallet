export async function isConnectedVideoDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videosDevices = devices.filter(
        (device) => device.kind === "videoinput"
    );
    return videosDevices.length > 0;
}
