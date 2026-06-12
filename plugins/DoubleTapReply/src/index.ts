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

    // Dump all 4 action handler types
    try {
      const ah = FluxDispatcher._actionHandlers;
      const raw = ah?._dependencyGraph ?? ah;
      alert("all action types:\n" + Object.keys(raw ?? {}).join("\n"));
    } catch (e: any) {
      alert("ah error: " + e);
    }

    const focusInput = () => {
      try {
        const RN = require("react-native");
        const TIS = RN.TextInputState;
        const lastFocused = TIS?.currentlyFocusedInput?.()
          ?? TIS?.currentlyFocusedField?.();
        if (lastFocused) {
          TIS.focusTextInput(lastFocused);
        } else {
          const NM = RN.NativeModules;
          NM?.AndroidKeyboard?.showKeyboard?.();
          NM?.Keyboard?.show?.();
        }
      } catch (e: any) {
        console.warn("[DTR] focusInput:", e);
      }
    };

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
      // Debug: alert on every MESSAGE_REACTION_ADD
      if (event?.type === "MESSAGE_REACTION_ADD") {
        alert("interceptor hit!\noptimistic=" + event.optimistic +
              "\nauthorId=" + event.messageAuthorId +
              "\nrecentSheet=" + recentSheet);
      }

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

      alert("MATCH - starting reply and swallowing reaction");

      ReplyActions.createPendingReply({ message, channel, shouldMention: true });

      setTimeout(focusInput, 150);

      if (ReactionActions?.removeReaction) {
        setTimeout(() => {
          try { ReactionActions.removeReaction(channelId, messageId, emoji); } catch {}
        }, 50);
      }

      return true;
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
