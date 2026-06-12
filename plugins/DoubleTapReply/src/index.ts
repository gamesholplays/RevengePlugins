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

    // Dump actual action type names from nodes
    try {
      const nodes = FluxDispatcher._actionHandlers?.nodes;
      if (nodes) {
        const types: string[] = Object.keys(nodes);
        const matches = types.filter(t =>
          t.includes("FOCUS") || t.includes("KEYBOARD") ||
          t.includes("EDITOR") || t.includes("INPUT") || t.includes("CHAT")
        );
        alert("focus types:\n" + (matches.length ? matches.join("\n") : "none, total=" + types.length));
      } else {
        alert("no nodes");
      }
    } catch (e: any) {
      alert("nodes err: " + e);
    }

    const focusInput = () => {
      try {
        const RN = require("react-native");
        const TIS = RN.TextInputState;
        const lastFocused = TIS?.currentlyFocusedInput?.()
          ?? TIS?.currentlyFocusedField?.();
        if (lastFocused) {
          TIS.focusTextInput(lastFocused);
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

      // Mutate the event so Discord's own handlers skip it
      // (return true doesn't block in this Revenge version)
      event.optimistic = false;
      event.messageAuthorId = "0";

      // 1. Start reply
      ReplyActions.createPendingReply({ message, channel, shouldMention: true });

      // 2. Focus keyboard
      setTimeout(focusInput, 150);

      // 3. Cancel network call
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
