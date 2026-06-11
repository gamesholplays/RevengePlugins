import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
    onLoad() {
        const GestureHandler = findByProps("TapGestureHandler");
        alert("[DTR] TapGestureHandler keys: " + Object.keys(GestureHandler).join(", "));
    },
    onUnload() {},
};
