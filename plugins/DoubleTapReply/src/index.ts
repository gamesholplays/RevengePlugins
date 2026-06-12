import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
  onLoad() {
    const ReplyActions   = findByProps("createPendingReply");
    const ChannelStore   = findByStoreName("ChannelStore");
    const MessageStore   = findByStoreName("MessageStore");
    const UserStore      = findByStoreName("UserStore");
    const FluxDispatcher = findByProps("_interceptors", "_subscriptions");

    if (!ReplyActions || !ChannelStore || !MessageStore || !FluxDispatcher) {
      console.error("[DTR] Missing core modules");
      return;
    }

    // ── Keyboard: find Discord's chat input focus utility ──────────────────
    // Discord exposes a module with `focus` that targets the chat input.
    // Try several known shapes; log which one works so you can trim later.
    const ChatInputRef =
      findByProps("chatInputRef") ??
      findByProps("setChatInputFocus") ??
      findByProps("focusChatInput");

    const focusInput = () => {
      if (ChatInputRef?.focusChatInput) {
        try { ChatInputRef.focusChatInput(); return; } catch (e) { console.warn("[DTR] focusChatInput threw:", e); }
      }
      if (ChatInputRef?.setChatInputFocus) {
        try { ChatInputRef.setChatInputFocus(true); return; } catch (e) { console.warn("[DTR] setChatInputFocus threw:", e); }
      }
      if (ChatInputRef?.chatInputRef?.current?.focus) {
        try { ChatInputRef.chatInputRef.current.focus(); return; } catch (e) { console.warn("[DTR] chatInputRef.focus threw:", e); }
      }
      // Last resort: dispatch a Flux event Discord uses internally for this
      try {
        FluxDispatcher.dispatch({ type: "CHANNEL_EDITOR_FOCUS" });
      } catch (e) {
        console.warn("[DTR] CHANNEL_EDITOR_FOCUS dispatch failed:", e);
      }
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

      // 1. Reply
      ReplyActions.createPendingReply({ message, channel, shouldMention: true });

      // 2. Keyboard — after reply bar renders
      setTimeout(focusInput, 100);

      // 3. Cancel the reaction by dispatching the REMOVE event ourselves.
      //    We do this AFTER returning false (letting the ADD through)
      //    so the optimistic update lands first, then we undo it.
      //    Using setTimeout(0) queues it after the current dispatch cycle.
      const currentUser = UserStore?.getCurrentUser?.();
      setTimeout(() => {
        try {
          FluxDispatcher.dispatch({
            type: "MESSAGE_REACTION_REMOVE",
            channelId,
            messageId,
            emoji,
            userId: currentUser?.id,
            optimistic: true,
          });
        } catch (e) {
          console.warn("[DTR] reaction remove dispatch failed:", e);
        }
      }, 0);

      return false; // let the ADD through so we have something to remove
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
