import { findByProps } from "@vendetta/metro";

export default {
    onLoad() {
        const onPressModule = findByProps("onPress");
        const keys = onPressModule ? Object.keys(onPressModule).join(", ") : "none";
        alert("[DoubleTapReply] onPress module keys: " + keys);

        const onLongPressModule = findByProps("onLongPress");
        const keys2 = onLongPressModule ? Object.keys(onLongPressModule).join(", ") : "none";
        alert("[DoubleTapReply] onLongPress module keys: " + keys2);
    },

    onUnload() {},
};
