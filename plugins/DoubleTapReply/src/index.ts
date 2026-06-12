import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
  onLoad() {
    const ReplyActions   = findByProps("createPendingReply");
    const ChannelStore   = findByStoreName("ChannelStore");
    const MessageStore   = findByStoreName("MessageStore");
    const FluxDispatcher = findByProps("_interceptors", "_subscriptions");
    const ReactionActions = findByProps("removeReaction", "removeEmojiReactions");

    if (!ReplyActions || !ChannelStore || !MessageStore || !FluxDispatcher) {
      alert("[DTR] missing core modules:\n" +
        "ReplyActions=" + !!ReplyActions + "\n" +
        "ChannelStore=" + !!ChannelStore + "\n" +
        "MessageStore=" + !!MessageStore + "\n" +
        "FluxDispatcher=" + !!FluxDispatcher
      );
      return;
    }

    alert("[DTR] loaded OK\nReactionActions=" + !!ReactionActions + 
          "\nDispatcher keys=" + Object.keys(FluxDispatcher).slice(0,6).join(", "));

    // ── Sheet tracker ────────────────────────────────────────────────────
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

    // ── Main interceptor ─────────────────────────────────────────────────
    const interceptor = (event: any) => {
      // Log EVERYTHING so we can see what double-tap actually fires
      if (event?.type?.toLowerCase().includes("react")) {
        alert("EVENT: " + event.type + 
              "\noptimistic=" + event.optimistic + 
              "\nauthorId=" + event.messageAuthorId +
              "\nemojiName=" + event.emoji?.name);
      }

      if (event?.type !== "MESSAGE_REACTION_ADD") return false;
      if (!event.optimistic)     return false;
      if (event.messageAuthorId) return false;
      if (recentSheet)           return false;

      const { channelId, messageId, emoji } = event;
      if (!channelId || !messageId) return false;

      const channel = ChannelStore.getChannel(channelId);
      const message = MessageStore.getMessage(channelId, messageId);
      if (!channel || !message) return false;

      alert("[DTR] MATCH - starting reply, swallowing reaction");

      // 1. Start reply
      ReplyActions.createPendingReply({ message, channel, shouldMention: true });

      // 2. Remove reaction server-side (belt+suspenders since we swallow the ADD)
      if (ReactionActions?.removeReaction) {
        setTimeout(() => {
          try { 
            ReactionActions.removeReaction(channelId, messageId, emoji);
          } catch (e) {
            alert("[DTR] removeReaction error: " + e);
          }
        }, 50);
      }

      return true; // swallow the ADD
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
