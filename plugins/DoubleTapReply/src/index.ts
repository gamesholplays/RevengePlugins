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
        let actionSheetOpen = false;

        const sheetInterceptor = (event: any) => {
            if (event?.type === "SHOW_ACTION_SHEET") actionSheetOpen = true;
            if (event?.type === "HIDE_ACTION_SHEET") actionSheetOpen = false;
            return false;
        };

        const interceptor = (event: any) => {
            if (event?.type !== "MESSAGE_REACTION_ADD") return false;
            if (actionSheetOpen) return false;

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
