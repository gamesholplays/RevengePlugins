import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
  onLoad() {
    const ReplyActions    = findByProps("createPendingReply");
    const ChannelStore    = findByStoreName("ChannelStore");
    const MessageStore    = findByStoreName("MessageStore");
    const FluxDispatcher  = findByProps("_interceptors", "_subscriptions");
    const ReactionActions = findByProps("removeReaction", "removeEmojiReactions");
    const ChatInputUtils  = findByProps("getChatInputRef", "getBestActiveInput");

    if (!ReplyActions || !ChannelStore || !MessageStore || !FluxDispatcher) {
      console.error("[DTR] missing core modules");
      return;
    }

    // Inspect what getChatInputRef returns at runtime
    setTimeout(() => {
      try {
        const ref = ChatInputUtils?.getChatInputRef?.();
        const best = ChatInputUtils?.getBestActiveInput?.();
        alert(
          "getChatInputRef: " + JSON.stringify(ref, null, 2).slice(0, 200) +
          "\ntype: " + typeof ref +
          "\nkeys: " + Object.keys(ref ?? {}).join(", ") +
          "\n\ngetBestActiveInput: " + typeof best +
          "\nbestKeys: " + Object.keys(best ?? {}).join(", ") +
          "\nhasFocus: " + typeof best?.focus +
          "\nhasCurrentFocus: " + typeof best?.current?.focus
        );
      } catch (e: any) {
        alert("inspect error: " + e);
      }
    }, 1000);

    const focusInput = () => {
      try {
        const ref = ChatInputUtils?.getChatInputRef?.()
          ?? ChatInputUtils?.getBestActiveInput?.();
        if (ref?.focus) {
          ref.focus();
        } else if (ref?.current?.focus) {
          ref.current.focus();
        }
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

      FluxDispatcher.dispatch({
        type: "CREATE_PENDING_REPLY",
        message,
        channel,
        shouldMention: false,
        showMentionToggle: true,
        mediaMention: false,
        source: "action_sheet",
      });

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
