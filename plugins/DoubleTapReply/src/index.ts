import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
  onLoad() {
    const ReplyActions    = findByProps("createPendingReply");
    const ChannelStore    = findByStoreName("ChannelStore");
    const MessageStore    = findByStoreName("MessageStore");
    const FluxDispatcher  = findByProps("_interceptors", "_subscriptions");
    const ReactionActions = findByProps("removeReaction", "removeEmojiReactions");

    if (!ReplyActions || !ChannelStore || !MessageStore || !FluxDispatcher) {
      alert("[DTR] missing modules");
      return;
    }

    alert("[DTR] dispatcher keys:\n" + Object.keys(FluxDispatcher).join("\n"));

    let recentSheet = false;
    let sheetTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingDoubleTap: { channelId: string; messageId: string } | null = null;
    let bannerDumped = false;

    const sheetInterceptor = (event: any) => {
      if (event?.type === "SHOW_ACTION_SHEET") {
        recentSheet = true;
        if (sheetTimer) clearTimeout(sheetTimer);
      }
      if (event?.type === "HIDE_ACTION_SHEET") {
        if (sheetTimer) clearTimeout(sheetTimer);
        sheetTimer = setTimeout(() => { recentSheet = false; }, 1000);
      }
      return false;
    };

    const interceptor = (event: any) => {
      if (event?.type === "UPDATE_FORCE_SHOW_DOUBLE_TAP_TO_REACT_BANNER") {
        if (!bannerDumped) {
          bannerDumped = true;
          const keys = Object.keys(event).join(", ");
          const full = JSON.stringify(event).slice(0, 400);
          alert("BANNER keys: " + keys + "\nfull: " + full);
        }

        if (recentSheet) return false;

        const channelId = event.channelId ?? event.channel_id;
        const messageId = event.messageId ?? event.message_id ?? event.id;
        if (!channelId || !messageId) return false;

        const channel = ChannelStore.getChannel(channelId);
        const message = MessageStore.getMessage(channelId, messageId);
        if (!channel || !message) return false;

        pendingDoubleTap = { channelId, messageId };
        setTimeout(() => { pendingDoubleTap = null; }, 1000);

        ReplyActions.createPendingReply({ message, channel, shouldMention: true });

        return false;
      }

      if (event?.type === "MESSAGE_REACTION_ADD" && event.optimistic === true && !event.messageAuthorId) {
        if (pendingDoubleTap) {
          if (ReactionActions?.removeReaction) {
            const { channelId, messageId } = pendingDoubleTap;
            const emoji = event.emoji;
            setTimeout(() => {
              try { ReactionActions.removeReaction(channelId, messageId, emoji); } catch {}
            }, 50);
          }
          return true;
        }
      }

      if (
        event?.type === "MESSAGE_REACTION_ADD" &&
        event.optimistic !== true &&
        event.messageAuthorId &&
        pendingDoubleTap &&
        event.channelId === pendingDoubleTap.channelId &&
        event.messageId === pendingDoubleTap.messageId
      ) {
        return true;
      }

      return false;
    };

    FluxDispatcher._interceptors.push(sheetInterceptor);
    FluxDispatcher._interceptors.push(interceptor);

    (this as any)._interceptor      = interceptor;
    (this as any)._sheetInterceptor = sheetInterceptor;
    (this as any)._dispatcher       = FluxDispatcher;
  },

  onUnload() {
    const { _interceptor, _sheetInterceptor, _dispatcher } = this as any;
    if (_dispatcher) {
      for (const fn of [_interceptor, _sheetInterceptor]) {
        const idx = _dispatcher._interceptors.indexOf(fn);
        if (idx !== -1) _dispatcher._interceptors.splice(idx, 1);
      }
    }
  },
};
