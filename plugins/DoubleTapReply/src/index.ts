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

    const focusInput = () => {
      try {
        const fiberKeys = Object.keys(globalThis).filter(k => k.startsWith("__reactFiber"));
        const inputs: string[] = [];
        let focused = false;

        for (const key of fiberKeys) {
          const fiber = (globalThis as any)[key];
          if (!fiber) continue;

          const visit = (node: any, depth: number) => {
            if (!node || depth > 300 || focused) return;
            try {
              const isTextInput = node.memoizedProps?.onChangeText != null;
              const hasFocus = typeof node.stateNode?.focus === "function";
              if (isTextInput) {
                inputs.push("depth=" + depth + " hasFocus=" + hasFocus + " props=" + Object.keys(node.memoizedProps ?? {}).slice(0, 6).join(","));
                if (hasFocus) {
                  node.stateNode.focus();
                  focused = true;
                  return;
                }
              }
              visit(node.child, depth + 1);
              visit(node.sibling, depth + 1);
            } catch {}
          };
          visit(fiber, 0);
        }

        alert("fiberKeys=" + fiberKeys.length +
              "\ninputs found=" + inputs.length +
              "\nfocused=" + focused +
              "\n\n" + inputs.slice(0, 5).join("\n"));
      } catch (e: any) {
        alert("focusInput error: " + e);
      }
    };

    // Test on load after 2s so we can see what's on screen
    setTimeout(focusInput, 2000);

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
        shouldMention: true,
        showMentionToggle: true,
      });

      setTimeout(focusInput, 300);

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
