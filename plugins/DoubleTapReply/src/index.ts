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
            alert("[DoubleTapReply] FAILED: Could not find MessageActions");
            return;
        }

        const replyFn: string =
            "replyToMessage" in MessageActions ? "replyToMessage" :
            "startReply" in MessageActions ? "startReply" :
            "createPendingReply";

        alert("[DoubleTapReply] Found MessageActions, replyFn: " + replyFn);

        const MessagePressModule =
            findByProps("handleMessagePress") ??
            findByProps("onPressMessage") ??
            findByProps("pressMessage");

        if (!MessagePressModule) {
            alert("[DoubleTapReply] FAILED: Could not find message press handler");
            return;
        }

        const pressFn: string =
            "handleMessagePress" in MessagePressModule ? "handleMessagePress" :
            "onPressMessage" in MessagePressModule ? "onPressMessage" :
            "pressMessage";

        alert("[DoubleTapReply] Found press handler: " + pressFn);

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
                            alert("[DoubleTapReply] reply call failed: " + e);
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
