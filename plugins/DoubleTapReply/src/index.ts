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

    // Track the pending double-tap so we can match it to the ADD
    let pendingDoubleTap: { channelId: string; messageId: string } | null = null;

    const interceptor = (event: any) => {
      // ── Step 1: catch the double-tap signal BEFORE network call ──────────
      if (event?.type === "UPDATE_FORCE_SHOW_DOUBLE_TAP_TO_REACT_BANNER") {
        if (recentSheet) return false;

        const channelId = event.channelId;
        const messageId = event.messageId;
        if (!channelId || !messageId) return false;

        const channel = ChannelStore.getChannel(channelId);
        const message = MessageStore.getMessage(channelId, messageId);
        if (!channel || !message) return false;

        // Store so we can also block the ADD that follows
        pendingDoubleTap = { channelId, messageId };
        setTimeout(() => { pendingDoubleTap = null; }, 1000);

        // Start reply
        ReplyActions.createPendingReply({ message, channel, shouldMention: true });

        // TODO: open keyboard here once we know the right event/function

        return false; // let banner event through, we block the ADD below
      }

      // ── Step 2: block the optimistic ADD that follows ────────────────────
      if (event?.type === "MESSAGE_REACTION_ADD" && event.optimistic === true && !event.messageAuthorId) {
        if (pendingDoubleTap) {
          // Also call removeReaction to cancel any in-flight network request
          if (ReactionActions?.removeReaction) {
            const { channelId, messageId } = pendingDoubleTap;
            const emoji = event.emoji;
            setTimeout(() => {
              try { ReactionActions.removeReaction(channelId, messageId, emoji); } catch {}
            }, 50);
          }
          return true; // swallow the ADD
        }
      }

      // ── Step 3: block the server confirmation if we started a reply ──────
      if (
        event?.type === "MESSAGE_REACTION_ADD" &&
        event.optimistic !== true &&
        event.messageAuthorId &&
        pendingDoubleTap &&
        event.channelId === pendingDoubleTap.channelId &&
        event.messageId === pendingDoubleTap.messageId
      ) {
        return true; // swallow server echo too
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
