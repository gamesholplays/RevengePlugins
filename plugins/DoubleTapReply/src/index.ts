import { findByProps } from "@vendetta/metro";

export default {
    onLoad() {
        const MessageActions =
            findByProps("replyToMessage") ??
            findByProps("startReply") ??
            findByProps("createPendingReply");

        if (!MessageActions) {
            alert("[DoubleTapReply] FAILED: Could not find MessageActions");
            return;
        }

        const replyFn: string =
            "replyToMessage" in MessageActions ? "replyToMessage" :
            "startReply" in MessageActions ? "startReply" :
            "createPendingReply";

        alert("[DoubleTapReply] Found MessageActions, replyFn: " + replyFn);

        const candidates = [
            "handleMessagePress",
            "onPressMessage",
            "pressMessage",
            "onPress",
            "handlePress",
            "onTap",
            "handleTap",
            "onMessagePress",
            "messagePressed",
            "onMessageTap",
            "handleMessageTap",
            "onLongPress",
            "handleLongPress",
        ];

        let found = "";
        for (const prop of candidates) {
            const mod = findByProps(prop);
            if (mod) found += prop + ", ";
        }
        alert("[DoubleTapReply] Found props: " + (found || "NONE"));
    },

    onUnload() {},
};
