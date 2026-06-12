import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
  onLoad() {
    const ReplyActions     = findByProps("createPendingReply");
    const ChannelStore     = findByStoreName("ChannelStore");
    const MessageStore     = findByStoreName("MessageStore");

    if (!ReplyActions || !ChannelStore || !MessageStore) {
      console.error("[DTR] Missing core modules");
      return;
    }

    const FluxDispatcher = findByProps("_interceptors", "_subscriptions");

    // ── Keyboard focus ──────────────────────────────────────────────────────
    // Try multiple known module shapes across Revenge/Bunny versions
    const KeyboardUtils   = findByProps("openKeyboard", "dismissKeyboard");
    const ChatInputFocus  = findByProps("forceFocus", "setFocused"); // some builds
    const DeviceEventEmitter = findByProps("emit", "addListener", "removeAllListeners");

    const focusInput = () => {
      // Method 1 – explicit openKeyboard utility
      if (KeyboardUtils?.openKeyboard) {
        try { KeyboardUtils.openKeyboard(); return; } catch {}
      }
      // Method 2 – forceFocus on the chat input
      if (ChatInputFocus?.forceFocus) {
        try { ChatInputFocus.forceFocus(); return; } catch {}
      }
      // Method 3 – DeviceEventEmitter signal (works on most RN Discord builds)
      if (DeviceEventEmitter?.emit) {
        try { DeviceEventEmitter.emit("RCTKeyboardWillShow", {}); } catch {}
      }
    };

    // ── Reaction removal ─────────────────────────────────────────────────────
    // Don't freeze the reference at load time – some modules register late.
    const getRemoveFn = () => {
      const m =
        findByProps("removeReaction") ??
        findByProps("deleteReaction")  ??
        findByProps("toggleReaction");   // fallback: toggle off an existing reaction
      return m?.removeReaction ?? m?.deleteReaction ?? m?.toggleReaction ?? null;
    };

    // ── Sheet tracker ────────────────────────────────────────────────────────
    let recentSheet  = false;
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

    // ── Main interceptor ─────────────────────────────────────────────────────
    const interceptor = (event: any) => {
      if (event?.type !== "MESSAGE_REACTION_ADD") return false;
      if (!event.optimistic)      return false; // not a local tap
      if (event.messageAuthorId)  return false; // has author id → manual long-press flow
      if (recentSheet)            return false; // preceded by action sheet → manual

      const { channelId, messageId, emoji } = event;
      if (!channelId || !messageId) return false;

      const channel = ChannelStore.getChannel(channelId);
      const message = MessageStore.getMessage(channelId, messageId);
      if (!channel || !message) return false;

      // 1. Create the pending reply
      ReplyActions.createPendingReply({
        message,
        channel,
        shouldMention: true,
      });

      // 2. Open keyboard so the user can type immediately
      //    Small delay lets the reply bar render first
      setTimeout(focusInput, 80);

      // 3. Remove the reaction that was optimistically added
      //    Resolved at call-time so late-registering modules are found
      setTimeout(() => {
        const removeFn = getRemoveFn();
        if (removeFn) {
          try { removeFn(channelId, messageId, emoji); } catch (e) {
            console.warn("[DTR] removeReaction failed:", e);
          }
        } else {
          console.warn("[DTR] No reaction-removal module found");
        }
      }, 120);

      return true; // swallow the original event
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
