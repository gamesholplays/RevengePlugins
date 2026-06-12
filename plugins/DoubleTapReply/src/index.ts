import { findByProps, findByStoreName } from "@vendetta/metro";

const DOUBLE_TAP_MS = 350;
let lastTap: { messageId: string; timestamp: number } | null = null;

export default {
    onLoad() {
        const ReplyActions = findByProps("createPendingReply");
        const ChannelStore = findByStoreName("ChannelStore");

        if (!ReplyActions || !ChannelStore) {
            alert("[DTR] Missing modules");
            return;
        }

        const FluxDispatcher = findByProps("_interceptors", "_subscriptions");

        const interceptor = (event: any) => {
            if (event?.type !== "SHOW_ACTION_SHEET") return false;

            const props = event?.content?.props;
            const message = props?.message;
            const channel = props?.channel ?? ChannelStore.getChannel(message?.channel_id);

            if (!message?.id) return false;

            const now = Date.now();

            if (
                lastTap &&
                lastTap.messageId === message.id &&
                now - lastTap.timestamp < DOUBLE_TAP_MS
            ) {
                lastTap = null;
                ReplyActions.createPendingReply({
                    message,
                    channel,
                    shouldMention: true,
                });
                return true; // true = swallow the event (don't show action sheet)
            }

            lastTap = { messageId: message.id, timestamp: now };
            return false; // let first long press show action sheet normally
        };

        FluxDispatcher._interceptors.push(interceptor);
        (this as any)._interceptor = interceptor;
        (this as any)._dispatcher = FluxDispatcher;
    },

    onUnload() {
        const { _interceptor, _dispatcher } = this as any;
        if (_dispatcher && _interceptor) {
            const idx = _dispatcher._interceptors.indexOf(_interceptor);
            if (idx !== -1) _dispatcher._interceptors.splice(idx, 1);
        }
        lastTap = null;
    },
};
