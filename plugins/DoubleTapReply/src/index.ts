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

        const interceptor = (event: any) => {
            if (event?.type !== "MESSAGE_REACTION_ADD") return false;
            if (!event.optimistic) return false; // double-tap first event has optimistic:true
            if (event.messageAuthorId) return false; // manual reacts have messageAuthorId

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
    },
};
