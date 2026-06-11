import { findByName } from "@vendetta/metro";

export default {
    onLoad() {
        const names = [
            "Message",
            "MessageItem",
            "ChatMessage",
            "BaseMessage",
            "MessageContent",
            "ChannelMessage",
            "MessageListItem",
            "MessageWrapper",
        ];

        let found = "";
        for (const name of names) {
            const mod = findByName(name, false);
            if (mod) found += name + ", ";
        }
        alert("[DoubleTapReply] Found by name: " + (found || "NONE"));
    },

    onUnload() {},
};
