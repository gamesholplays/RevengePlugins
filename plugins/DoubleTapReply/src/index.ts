import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
  onLoad() {
    const ReplyActions    = findByProps("createPendingReply");
    const ChannelStore    = findByStoreName("ChannelStore");
    const MessageStore    = findByStoreName("MessageStore");
    const FluxDispatcher  = findByProps("_interceptors", "_subscriptions");

    // Real reaction remove module — [6834]
    const ReactionActions = findByProps("removeReaction", "removeEmojiReactions");

    // Real keyboard focus module — [1612]
    const ChatInputFocus  = findByProps("getIsAnyChatInputFocused");

    if (!ReplyActions || !ChannelStore || !MessageStore || !FluxDispatcher) {
      console.error("[DTR] Missing core modules");
      return;
    }

    if (!ReactionActions) console.warn("[DTR] removeReaction module not found");
    if (!ChatInputFocus)  console.warn("[DTR] ChatInputFocus module not found");

    // Log what focus module actually exports so we know the setter name
    if (ChatInputFocus) {
      console.info("[DTR] ChatInputFocus keys:", Object.keys(ChatInputFocus).join(", "));
    }

    const focusInput = () => {
      if (!ChatInputFocus) return;
      // Try every plausible setter name — we'll know the real one from the log above
      try { ChatInputFocus.setsIsAnyInputFocused?.(true); } catch {}
      try { ChatInputFocus.setIsAnyChatInputFocused?.(true); } catch {}
      try { ChatInputFocus.focusChatInput?.(); } catch {}
    };

    // ── Sheet tracker ──────────────────────────────────────────────────────
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

    // ── Main interceptor ───────────────────────────────────────────────────
    const interceptor = (event: any) => {
      if (event?.type !== "MESSAGE_REACTION_ADD") return false;
      if (!event.optimistic)     return false;
      if (event.messageAuthorId) return false;
      if (recentSheet)           return false;

      const { channelId, messageId, emoji } = event;
      if (!channelId || !messageId) return false;

      const channel = ChannelStore.getChannel(channelId);
      const message = MessageStore.getMessage(channelId, messageId);
      if (!channel || !message) return false;

      // 1. Block the ADD entirely — return true swallows it before Discord sees it
      //    This means no optimistic update, no server call, nothing to undo
      //    We must call removeReaction ourselves to be safe if anything slipped through

      // 2. Start reply
      ReplyActions.createPendingReply({ message, channel, shouldMention: true });

      // 3. Open keyboard after reply bar renders
      setTimeout(focusInput, 150);

      // 4. Belt-and-suspenders: also call removeReaction in case Discord
      //    has already queued a server-side add before our interceptor ran
      if (ReactionActions?.removeReaction) {
        setTimeout(() => {
          try { ReactionActions.removeReaction(channelId, messageId, emoji); } catch (e) {
            console.warn("[DTR] removeReaction threw:", e);
          }
        }, 50);
      }

      return true; // swallow — no reaction added at all
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
