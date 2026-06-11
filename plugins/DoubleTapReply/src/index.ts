import { findByProps } from "@vendetta/metro";

export default {
    onLoad() {
        const FluxDispatcher = findByProps("dispatch", "subscribe");
        const orig = FluxDispatcher.dispatch.bind(FluxDispatcher);

        FluxDispatcher.dispatch = (event: any) => {
            if (event?.type && !event.type.includes("HEARTBEAT") && !event.type.includes("TRACK")) {
                console.log("[DTR]", event.type, JSON.stringify(event).slice(0, 100));
            }
            return orig(event);
        };

        (this as any)._orig = orig;
        (this as any)._fd = FluxDispatcher;
    },
    onUnload() {
        if ((this as any)._fd) (this as any)._fd.dispatch = (this as any)._orig;
    },
};
