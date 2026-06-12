import { findByProps, findByStoreName } from "@vendetta/metro";
import { ReactNative } from "@vendetta/metro/common";

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

    // Dump what ReactNative actually exports
    alert("ReactNative keys:\n" + Object.keys(ReactNative ?? {}).join("\n"));

    const focusInput = () => {
      try {
        const TIS = (ReactNative as any)?.TextInputState;
        const lastFocused = TIS?.currentlyFocusedInput?.()
          ?? TIS?.currentlyFocusedField?.();
        if (lastFocused) TIS.focusTextInput(lastFocused);
      } catch (e: any) {
        console.warn("[DTR] focusInput:", e);
      }
    };

    let recentSheet = false;
    let sheetTimer: ReturnType<typeof setTimeout> | null = null;
    const blocked = new Set<string>();

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

      const { channelId, messageId, emoji } = event;
      if (!channelId || !messageId) return false;

      const key = channelId + ":" + messageId + ":" + (emoji?.name ?? emoji?.id ?? "");

      if (blocked.has(key)) {
        blocked.delete(key);
        return true;
      }

      if (recentSheet) return false;
      if (!event.optimistic) return false;

      const channel = ChannelStore.getChannel(channelId);
      const message = MessageStore.getMessage(channelId, messageId);
      if (!channel || !message) return false;

      blocked.add(key);
      setTimeout(() => blocked.delete(key), 5000);

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
