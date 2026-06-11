import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
    onLoad() {
        // Check what stores are available
        const stores = [
            "MessageStore",
            "ChannelStore", 
            "SelectedChannelStore",
            "PendingReplyStore",
        ];

        let found = "";
        for (const name of stores) {
            try {
                const store = findByStoreName(name);
                if (store) found += name + ", ";
            } catch {}
        }
        alert("[DTR] Stores: " + (found || "NONE"));
    },
    onUnload() {},
};
