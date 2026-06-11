import { findByProps } from "@vendetta/metro";

const DOUBLE_TAP_MS = 350;
let lastTap: { messageId: string; timestamp: number } | null = null;

export default {
    onLoad() {
        const MessageActions =
            findByProps("replyToMessage") ??
            findByProps("createPendingReply");

        if (!MessageActions) {
            alert("[DoubleTapReply] FAILED: No MessageActions");
            return;
        }

        const replyFn = "replyToMessage" in MessageActions
            ? "replyToMessage"
            : "createPendingReply";

        const FluxDispatcher = findByProps("dispatch", "subscribe", "unsubscribe");
        const ChannelStore = findByProps("getChannel", "getDMFromUserId");

        if (!FluxDispatcher) {
            alert("[DoubleTapReply] FAILED: No FluxDispatcher");
            return;
        }

        const handler = (event: any) => {
            // MESSAGE_LOCAL_PRESS or similar events fire on message tap
            const messageId = event?.messageId ?? event?.message?.id;
            const channelId = event?.channelId ?? event?.message?.channel_id;

            if (!messageId || !channelId) return;

            const now = Date.now();

            if (
                lastTap &&
                lastTap.messageId === messageId &&
                now - lastTap.timestamp < DOUBLE_TAP_MS
            ) {
                lastTap = null;
                const channel = ChannelStore?.getChannel(channelId);
                const message = event?.message ?? { id: messageId, channel_id: channelId };
                try {
                    MessageActions[replyFn]({ message, channel, shouldMention: true });
                } catch {
                    MessageActions[replyFn](channelId, message, true);
                }
                return;
            }

            lastTap = { messageId, timestamp: now };
        };

        // Try subscribing to known message press events
        FluxDispatcher.subscribe("MESSAGE_LOCAL_PRESS", handler);
        FluxDispatcher.subscribe("MESSAGE_PRESS", handler);

        (this as any)._handler = handler;
        (this as any)._dispatcher = FluxDispatcher;
    },

    onUnload() {
        const { _handler, _dispatcher } = this as any;
        if (_dispatcher && _handler) {
            _dispatcher.unsubscribe("MESSAGE_LOCAL_PRESS", _handler);
            _dispatcher.unsubscribe("MESSAGE_PRESS", _handler);
        }
        lastTap = null;
    },
};
