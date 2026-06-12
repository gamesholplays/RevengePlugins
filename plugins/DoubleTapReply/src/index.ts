import { findByProps, findByStoreName } from "@vendetta/metro";
import { ReactNative } from "@vendetta/metro/common";

export default {
  onLoad() {
    const ReplyActions   = findByProps("createPendingReply");
    const ChannelStore   = findByStoreName("ChannelStore");
    const MessageStore   = findByStoreName("MessageStore");
    const UserStore      = findByStoreName("UserStore");
    const FluxDispatcher = findByProps("_interceptors", "_subscriptions");

    // Module 10203 — has handleAddNewReactions, handleRemoveAllReactions
    // The actual per-reaction remove is dispatching MESSAGE_REACTION_REMOVE
    // OR calling the action directly. Let's grab module 10203 by its unique key.
    const ReactionOutOfSuperActions = findByProps("handleOutOfSuperReactions", "handleAddNewReactions");

    if (!ReplyActions || !ChannelStore || !MessageStore || !FluxDispatcher) {
      console.error("[DTR] Missing core modules");
      return;
    }

    // ── Keyboard focus via RN TextInputState ───────────────────────────────
    // There is no Discord-level focus module. Use RN's internal state directly.
    const TextInputState = ReactNative?.TextInputState
      ?? (ReactNative as any)?.NativeModules?.TextInputState;

    // Fallback: find the currently focused text input node via RN internals
    const focusInput = () => {
      try {
        // Discord's chat box is a TextInput — find it by looking at currently
        // registered text inputs and focus the last one (chat is always last)
        const { TextInputState: TIS } = require("react-native");
        // currentlyFocusedInput() returns the ref on RN >= 0.65
        // On older: currentlyFocusedField() returns a tag
        const focused = TIS?.currentlyFocusedInput?.() ?? TIS?.currentlyFocusedField?.();
        // If something is already focused, blur+refocus to force keyboard up
        if (focused) {
          TIS?.blurTextInput?.(focused);
          setTimeout(() => TIS?.focusTextInput?.(focused), 50);
        } else {
          // Nothing focused — dispatch the Flux event Discord uses internally
          // when reply bar appears (seen in Discord's own reply flow)
          FluxDispatcher.dispatch({ type: "CLEAR_AUTOCOMPLETE" }); // triggers input reset
        }
      } catch (e) {
        console.warn("[DTR] focusInput failed:", e);
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

      // 1. Start reply
      ReplyActions.createPendingReply({ message, channel, shouldMention: true });

      // 2. Focus keyboard — after reply bar renders (needs a frame)
      setTimeout(focusInput, 150);

      // 3. Remove the reaction — dispatch MESSAGE_REACTION_REMOVE optimistically.
      //    We let the ADD go through (return false) so the store has it,
      //    then immediately undo it. userId must match for the store to remove it.
      const userId = UserStore?.getCurrentUser?.()?.id;
      setTimeout(() => {
        FluxDispatcher.dispatch({
          type: "MESSAGE_REACTION_REMOVE",
          channelId,
          messageId,
          emoji,          // same shape as the ADD event: { name, id, animated }
          userId,
          optimistic: true,
        });
      }, 50);

      return false; // let ADD land so REMOVE has something to undo
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
