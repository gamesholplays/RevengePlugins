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

    const { UIManager, findNodeHandle } = ReactNative as any;

    // DCDChatInput is Discord's native chat input component
    // We need to find its view tag to call focusTextInput on it
    // The tag is an integer assigned by RN to each native view
    // We can find it by locating the component instance

    // Try to find DCDChatInput ref via a module that holds it
    const ChatInputUtils = findByProps("insertText", "clearText")
      ?? findByProps("insertText")
      ?? findByProps("clearText");

    alert("ChatInputUtils: " + !!ChatInputUtils +
          (ChatInputUtils ? "\nkeys: " + Object.keys(ChatInputUtils).join(", ") : ""));

    const focusInput = () => {
      try {
        // Scan all modules for anything that looks like a ref to DCDChatInput
        const reg = (globalThis as any).modules;
        const candidates: string[] = [];
        for (const id in reg) {
          try {
            const exp = reg[id]?.publicModule?.exports ?? reg[id]?.exports;
            if (!exp || typeof exp !== "object") continue;
            const keys = Object.keys(exp);
            if (keys.some((k: string) => k.toLowerCase().includes("chatinput") ||
                k.toLowerCase().includes("textinput") ||
                k.toLowerCase().includes("inputref"))) {
              candidates.push("[" + id + "] " + keys.join(", "));
            }
          } catch {}
        }
        alert("candidates:\n" + candidates.slice(0, 8).join("\n\n") || "none");
      } catch (e: any) {
        alert("scan error: " + e);
      }
    };

    setTimeout(focusInput, 1000);

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
