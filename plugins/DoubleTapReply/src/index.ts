import { findByProps } from "@vendetta/metro";

export default {
    onLoad() {
        const mods = [
            "renderMessage",
            "getMessageColors",
            "getMessageBorderColor",
            "getMessageTextColor",
            "messageComponent",
            "MessageItem",
            "renderContent",
            "onTapAvatar",
            "onTapUsername",
            "onTapReaction",
        ];

        let found = "";
        for (const prop of mods) {
            const mod = findByProps(prop);
            if (mod) found += prop + ", ";
        }
        alert("[DTR] Found: " + (found || "NONE"));
    },
    onUnload() {},
};
