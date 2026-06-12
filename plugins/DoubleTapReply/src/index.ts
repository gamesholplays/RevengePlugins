import { findByProps, findByStoreName } from "@vendetta/metro";

export default {
  onLoad() {
    const ReplyActions    = findByProps("createPendingReply");
    const ChannelStore    = findByStoreName("ChannelStore");
    const MessageStore    = findByStoreName("MessageStore");
    const FluxDispatcher  = findByProps("_interceptors", "_subscriptions");
    const ReactionActions = findByProps("removeReaction", "removeEmojiReactions");

    if (!ReplyActions || !ChannelStore || !MessageStore || !FluxDispatcher) {
      alert("[DTR] missing modules");
      return;
    }

    // Log dispatcher keys so we can find _actionHandlers equivalent
    alert("[DTR] dispatcher keys:\n" + Object.keys(FluxDispatcher).join("\n"));

    let recentSheet = false;
    let sheetTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingDoubleTap: { channelId: string; messageId: string } | null = null;
    let bannerDumped = false;

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
      if (event?.type === "UPDATE_FORCE_SHOW_DOUBLE_TAP_TO_REACT_BANNER") {
        // Dump full event once so we know what fields it carries
        if (!bannerDumped) {
            bannerDumped = true;
            const keys = Object.keys(event).join(", ");
            const full = JSON.stringify(event).slice(0, 400);
            alert("BANNER keys: " + keys + "\nfull: " + full);
}
