import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
    onLoad() {
        const ReplyActions = findByProps("createPendingReply");
        const ChannelStore = findByStoreName("ChannelStore");
        const MessageStore = findByStoreName("MessageStore");
        const KeyboardUtils = findByProps("hideKeyboard", "focusTextInput")
            ?? findByProps("show", "dismiss", "scheduleLayoutAnimation")
            ?? findByProps("focusTextInput");

        if (!ReplyActions || !ChannelStore || !MessageStore) {
            alert("[DTR] Missing modules");
            return;
        }

        const FluxDispatcher = findByProps("_interceptors", "_subscriptions");

        const interceptor = (event: any) => {
            if (event?.type !== "MESSAGE_REACTION_ADD") return false;

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
            
            setTimeout(() => {
                try {
                    findByProps("focusTextInput")?.focusTextInput?.();
                } catch {}
            }, 300);
            
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
