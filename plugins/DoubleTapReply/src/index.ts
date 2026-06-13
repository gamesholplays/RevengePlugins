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

    const focusInput = () => {
      try {
        const ref = ChatInputUtils?.getChatInputRef?.();
        const best = ChatInputUtils?.getBestActiveInput?.();
        // Log what we get at this point in time
        alert(
          "ref type=" + typeof ref + " keys=" + Object.keys(ref ?? {}).join(",") +
          "\nbest type=" + typeof best + " keys=" + Object.keys(best ?? {}).join(",") +
          "\nref.focus=" + typeof ref?.focus +
          "\nref.current=" + typeof ref?.current +
          "\nref.current.focus=" + typeof ref?.current?.focus
        );
        if (ref?.focus) { ref.focus(); return; }
        if (ref?.current?.focus) { ref.current.focus(); return; }
        if (best?.focus) { best.focus(); return; }
        if (best?.current?.focus) { best.current.focus(); return; }
      } catch (e: any) {
        alert("focusInput error: " + e);
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

      // Try at 150ms, 300ms, 500ms in case it takes time to mount
      setTimeout(focusInput, 150);
      setTimeout(focusInput, 300);
      setTimeout(focusInput, 500);

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
