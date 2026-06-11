import { findByProps } from "@vendetta/metro";

export default {
    onLoad() {
        const FluxDispatcher = findByProps("dispatch", "subscribe", "unsubscribe");

        if (!FluxDispatcher) {
            alert("No FluxDispatcher found");
            return;
        }

        // Intercept ALL dispatched events and log ones that look message-related
        const origDispatch = FluxDispatcher.dispatch.bind(FluxDispatcher);
        FluxDispatcher.dispatch = (event: any) => {
            if (event?.type && (
                event.type.includes("MESSAGE") ||
                event.type.includes("PRESS") ||
                event.type.includes("TAP") ||
                event.type.includes("CLICK")
            )) {
                alert("Event: " + event.type + "\nKeys: " + Object.keys(event).join(", "));
            }
            return origDispatch(event);
        };

        (this as any)._origDispatch = origDispatch;
        (this as any)._dispatcher = FluxDispatcher;
    },

    onUnload() {
        const { _origDispatch, _dispatcher } = this as any;
        if (_dispatcher && _origDispatch) {
            _dispatcher.dispatch = _origDispatch;
        }
    },
};
