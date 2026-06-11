import { findByProps } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";

const DOUBLE_TAP_MS = 350;

let lastTap: { messageId: string; timestamp: number } | null = null;
const patches: (() => void)[] = [];

export default {
    onLoad() {
        const MessageActions =
            findByProps("replyToMessage") ??
            findByProps("startReply") ??
            findByProps("createPendingReply");

        if (!MessageActions) {
            console.warn("[DoubleTapReply] Could not find MessageActions");
            return;
        }

        const replyFn: string =
            "replyToMessage" in MessageActions ? "replyToMessage" :
            "startReply" in MessageActions ? "startReply" :
            "createPendingReply";

        // The message press handler module — try known names across Discord versions
        const MessagePressModule =
            findByProps("handleMessagePress") ??
            findByProps("onPressMessage");

        if (!MessagePressModule) {
            console.warn("[DoubleTapReply] Could not find message press handler");
            return;
        }

        const pressFn: string =
            "handleMessagePress" in MessagePressModule ? "handleMessagePress" :
            "onPressMessage";

        patches.push(
            instead(pressFn, MessagePressModule, (args, orig) => {
                const props = args?.[0];
                const message = props?.message ?? props;
                const channel = props?.channel;

                if (!message?.id) return orig(...args);

                const now = Date.now();

                if (
                    lastTap &&
                    lastTap.messageId === message.id &&
                    now - lastTap.timestamp < DOUBLE_TAP_MS
                ) {
                    lastTap = null;
                    try {
                        MessageActions[replyFn]({ message, channel, shouldMention: true });
                    } catch {
                        try {
                            MessageActions[replyFn](channel?.id, message, true);
                        } catch (e) {
                            console.error("[DoubleTapReply] reply call failed:", e);
                        }
                    }
                    return;
                }

                lastTap = { messageId: message.id, timestamp: now };
                return orig(...args);
            })
        );
    },

    onUnload() {
        patches.forEach(p => p?.());
        patches.length = 0;
        lastTap = null;
    },
};
