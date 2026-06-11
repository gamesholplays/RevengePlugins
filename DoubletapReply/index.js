import { findByProps } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";

const DOUBLE_TAP_MS = 350;

let lastTap = null;
const patches = [];

export default {
    onLoad() {
        // Find the module that holds the reply action
        const MessageActions = findByProps("replyToMessage")
            ?? findByProps("startReply")
            ?? findByProps("createPendingReply");

        if (!MessageActions) {
            console.warn("[DoubleTapReply] Could not find MessageActions");
            return;
        }

        const replyFn =
            MessageActions.replyToMessage ? "replyToMessage" :
            MessageActions.startReply ? "startReply" :
            "createPendingReply";

        // Find the message long-press / action sheet module.
        // Discord opens an action sheet on long press; on short press nothing
        // special happens. We intercept the component that receives onPress
        // for individual messages — found via its characteristic props.
        const MessageRecord = findByProps("handleMessagePress")
            ?? findByProps("onPressMessage")
            ?? findByProps("onPress", "message", "channel");

        if (!MessageRecord) {
            console.warn("[DoubleTapReply] Could not find message press handler");
            return;
        }

        // Determine which method to patch
        const pressFn =
            MessageRecord.handleMessagePress ? "handleMessagePress" :
            MessageRecord.onPressMessage ? "onPressMessage" :
            "onPress";

        patches.push(
            instead(pressFn, MessageRecord, (args, orig) => {
                // args[0] is typically the message object or an event object
                // depending on which module we landed on
                const message = args[0]?.message ?? args[0];
                const channel = args[0]?.channel;

                if (!message?.id) {
                    // Can't identify the message, fall through
                    return orig(...args);
                }

                const now = Date.now();

                if (
                    lastTap &&
                    lastTap.messageId === message.id &&
                    now - lastTap.timestamp < DOUBLE_TAP_MS
                ) {
                    // Double-tap! Trigger reply instead of normal press
                    lastTap = null;
                    try {
                        MessageActions[replyFn]({
                            message,
                            channel,
                            shouldMention: true,
                        });
                    } catch {
                        // Older positional-args API shape
                        try {
                            MessageActions[replyFn](channel?.id, message, true);
                        } catch (e) {
                            console.error("[DoubleTapReply] reply call failed:", e);
                        }
                    }
                    return; // swallow the original press
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
