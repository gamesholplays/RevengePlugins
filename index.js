/**
 * DoubleTapReply — Revenge Plugin (Bunny spec)
 *
 * Double-tap any message to start replying to it.
 *
 * How it works:
 *   Discord's chat renders each message via a component that exposes
 *   onLongPress / onPress props. We patch the component to inject an
 *   onPress wrapper that detects two taps within DOUBLE_TAP_MS ms on
 *   the same message and fires the reply action.
 *
 * Metro modules used:
 *   - The message component (found by prop signature)
 *   - The pending-reply dispatcher (MessageActions / ReplyManager)
 */

/** Maximum ms between two taps to count as a double-tap. */
const DOUBLE_TAP_MS = 350;

export default {
  /* ------------------------------------------------------------------ */
  /*  Manifest                                                            */
  /* ------------------------------------------------------------------ */
  name: "DoubleTapReply",
  description: "Double-tap a message to start replying to it.",
  authors: [{ name: "you", id: "0" }],
  version: "1.0.0",

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                           */
  /* ------------------------------------------------------------------ */
  patches: [],           // filled in onLoad, cleaned up onUnload
  _lastTap: null,        // { messageId, channelId, timestamp }

  onLoad() {
    const { findByProps, findByName } = revenge.metro;
    const { before, after } = revenge.patcher;

    // ------------------------------------------------------------------
    // 1.  Find the module that handles "start reply"
    //     In most Discord versions this lives in MessageActions under
    //     the name `startEditMessage` / `replyToMessage` / similar.
    //     We try several known property names for resilience.
    // ------------------------------------------------------------------
    const MessageActions =
      findByProps("replyToMessage") ??
      findByProps("startReply") ??
      findByProps("createPendingReply");

    if (!MessageActions) {
      console.warn("[DoubleTapReply] Could not find MessageActions — aborting.");
      return;
    }

    // Normalise the function name across Discord versions
    const replyFnName =
      "replyToMessage"  in MessageActions ? "replyToMessage"  :
      "startReply"      in MessageActions ? "startReply"      :
      "createPendingReply";

    // ------------------------------------------------------------------
    // 2.  Find the message component.
    //     Discord's chat message component is usually accessible via
    //     `findByName("Message")` or by a characteristic prop set.
    // ------------------------------------------------------------------
    const MessageComponent =
      findByName("Message", false) ??       // false = look in all modules
      findByProps("onLongPress", "message"); // fallback: prop-based lookup

    if (!MessageComponent) {
      console.warn("[DoubleTapReply] Could not find Message component — aborting.");
      return;
    }

    // ------------------------------------------------------------------
    // 3.  Patch the component's default export (or the object itself)
    // ------------------------------------------------------------------
    const target =
      typeof MessageComponent === "function"
        ? MessageComponent          // functional component
        : MessageComponent.default ?? MessageComponent; // module or object

    const self = this;

    const unpatch = before("render", target.prototype ?? target, function (args) {
      // args[0] is `props` for class components;
      // for function components we patch differently — see below.
    });

    // For function components (the common case in modern Discord RN)
    // we patch via `after` on the render result to inject onPress.
    const unpatch2 = after("default", MessageComponent, function (args, res) {
      // `args[0]` = props passed to the message component
      const props = args?.[0];
      if (!props?.message || !props?.channel) return res;

      const { message, channel } = props;

      // Clone the element tree shallowly to inject our tap handler
      if (!res?.props) return res;

      const originalOnPress = res.props.onPress;

      res.props.onPress = function (...pressArgs) {
        const now = Date.now();
        const last = self._lastTap;

        if (
          last &&
          last.messageId === message.id &&
          now - last.timestamp < DOUBLE_TAP_MS
        ) {
          // ✅ Double-tap detected — trigger reply
          self._lastTap = null;
          try {
            MessageActions[replyFnName]({
              message,
              channel,
              shouldMention: true,
            });
          } catch {
            // Older API shape: positional args
            MessageActions[replyFnName](channel.id, message, true);
          }
          return; // don't propagate to original press
        }

        // Record this tap
        self._lastTap = {
          messageId: message.id,
          channelId: channel.id,
          timestamp: now,
        };

        // Let the original single-tap behaviour run normally
        originalOnPress?.(...pressArgs);
      };

      return res;
    });

    this.patches.push(unpatch, unpatch2);
  },

  onUnload() {
    // Clean up all patches to restore original behaviour
    for (const unpatch of this.patches) {
      try { unpatch?.(); } catch { /* already removed */ }
    }
    this.patches = [];
    this._lastTap = null;
  },
};
