import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
    onLoad() {
        const ReplyActions = findByProps("createPendingReply");
        const ChannelStore = findByStoreName("ChannelStore");
        const MessageStore = findByStoreName("MessageStore");

        if (!ReplyActions || !ChannelStore || !MessageStore) {
            alert("[DTR] Missing modules");
            return;
        }

        const FluxDispatcher = findByProps("_interceptors", "_subscriptions");
        let recentSheet = false;
        let sheetTimer: any = null;

        const sheetInterceptor = (event: any) => {
            if (event?.type === "SHOW_ACTION_SHEET") {
                recentSheet = true;
                if (sheetTimer) clearTimeout(sheetTimer);
            }
            if (event?.type === "HIDE_ACTION_SHEET") {
                if (sheetTimer) clearTimeout(sheetTimer);
                // Keep recentSheet true for 1000ms after sheet closes
                // to catch the reaction event that fires after hide
                sheetTimer = setTimeout(() => {
                    recentSheet = false;
                }, 1000);
            }
            return false;
        };

        const interceptor = (event: any) => {
            if (event?.type !== "MESSAGE_REACTION_ADD") return false;
            if (!event.optimistic) return false;
            if (event.messageAuthorId) return false;
            if (recentSheet) return false; // came from action sheet, let it through

            const { channelId, messageId } = event;
            if (!channelId || !messageId) return false;

            const channel = ChannelStore.getChannel(channelId);
            const message = MessageStore.getMessage(channelId, messageId);
            if (!channel || !message) return false;

            ReplyActions.createPendingReply({
                message,
                channel,
                shouldMention: true,
            });

            return true;
        };

        FluxDispatcher._interceptors.push(sheetInterceptor);
        FluxDispatcher._interceptors.push(interceptor);
        (this as any)._interceptor = interceptor;
        (this as any)._sheetInterceptor = sheetInterceptor;
        (this as any)._dispatcher = FluxDispatcher;
    },

    onUnload() {
        const { _interceptor, _sheetInterceptor, _dispatcher } = this as any;
        if (_dispatcher) {
            [_interceptor, _sheetInterceptor].forEach(i => {
                const idx = _dispatcher._interceptors.indexOf(i);
                if (idx !== -1) _dispatcher._interceptors.splice(idx, 1);
            });
        }
    },
};
