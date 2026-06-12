import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
    onLoad() {
        const ReplyActions = findByProps("createPendingReply");
        const ChannelStore = findByStoreName("ChannelStore");
        const MessageStore = findByStoreName("MessageStore");
        const RemoveReaction = findByProps("removeReaction") ?? findByProps("deleteReaction");

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
            if (recentSheet) return false;

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

            // Remove the reaction that was added natively
            if (RemoveReaction)
