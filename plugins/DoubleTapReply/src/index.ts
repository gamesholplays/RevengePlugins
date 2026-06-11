import { findByProps } from "@vendetta/metro";

export default {
    onLoad() {
        // Scan for modules that have both a function and message-related props
        const candidates = [
            ["startReaction", "startEditMessage"],
            ["startEditMessage", "deleteMessage"],
            ["jumpToMessage", "fetchMessages"],
            ["clearChannel", "sendMessage"],
            ["sendMessage", "editMessage"],
        ];

        let results = "";
        for (const props of candidates) {
            const mod = findByProps(...props);
            if (mod) {
                results += "\n[" + props.join(",") + "]: " + Object.keys(mod).join(", ");
            }
        }

        alert("Modules found:" + (results || " NONE"));
    },
    onUnload() {},
};
