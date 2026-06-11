import { findByProps } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";

const DOUBLE_TAP_MS = 350;
let lastTap: { messageId: string; timestamp: number } | null = null;
const patches: (() => void)[] = [];

export default {
    onLoad() {
        const MessageActions = findByProps("startEditMessage", "deleteMessage");
        const ReplyActions = findByProps("getSendMessageOptionsForReply");

        if (!MessageActions && !ReplyActions) {
            alert("[DoubleTapReply] FAILED: no modules found");
            return;
        }

        // createPendingReply is the reply trigger - check which module has it
        const replyModule = findByProps("createPendingReply") ?? ReplyActions;

        if (!replyModule) {
            alert("[DoubleTapReply] FAILED: no reply module");
            return;
        }

        alert("[DoubleTapReply] Reply module keys: " + Object.keys(replyModule).join(", "));
    },

    onUnload() {
        patches.forEach(p => p?.());
        patches.length = 0;
        lastTap = null;
    },
};
