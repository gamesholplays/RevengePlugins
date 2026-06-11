import { findByProps } from "@vendetta/metro";

export default {
    onLoad() {
        const props = [
            "handleTouchStart",
            "onResponderGrant", 
            "setGestureState",
            "GestureHandler",
            "TapGestureHandler",
            "onSingleTap",
            "onDoubleTap",
            "numberOfTaps",
            "LongPressGestureHandler",
        ];

        let found = "";
        for (const prop of props) {
            const mod = findByProps(prop);
            if (mod) found += prop + ", ";
        }
        alert("[DTR] Found: " + (found || "NONE"));
    },
    onUnload() {},
};
