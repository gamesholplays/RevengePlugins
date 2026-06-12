import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
  onLoad() {
    const ReplyActions    = findByProps("createPendingReply");
    const ChannelStore    = findByStoreName("ChannelStore");
    const MessageStore    = findByStoreName("MessageStore");
    const FluxDispatcher  = findByProps("_interceptors", "_subscriptions");
    const ReactionActions = findByProps("removeReaction", "removeEmojiReactions");

    if (!ReplyActions || !ChannelStore || !MessageStore || !FluxDispatcher) {
      console.error("[DTR] missing core modules");
      return;
    }

    let recentSheet = false;
    let sheetTimer: ReturnType<typeof setTimeout> | null = null;

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
      // Only catch double-tap reactions:
      // optimistic=true means local gesture, no messageAuthorId means not a manual long-press pick
      if (event?.type !== "MESSAGE_REACTION_ADD") return false;
      if (event.optimistic !== true)  return false;
      if (event.messageAuthorId)      return false;
      if (recentSheet)                return false;

      const channelId = event.channelId;
      const messageId = event.messageId;
      const emoji     = event.emoji;
      if (!channelId || !messageId) return false;

      const channel = ChannelStore.getChannel(channelId);
      const message = MessageStore.getMessage(channelId, messageId);
      if (!channel || !message) return false;

      // 1. Start the reply
      ReplyActions.createPendingReply({ message, channel, shouldMention: true });

      // 2. Cancel the reaction — call removeReaction to reverse the server-side
      //    add that Discord already fired before our interceptor ran.
      //    We also return true to swallow the optimistic store update.
      if (ReactionActions?.removeReaction) {
        setTimeout(() => {
          try { ReactionActions.removeReaction(channelId, messageId, emoji); } catch {}
        }, 50);
      }

      // 3. Keyboard — placeholder until we find the right action type
      // TODO: dispatch focus action here

      return true; // swallow the optimistic ADD from the store
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
