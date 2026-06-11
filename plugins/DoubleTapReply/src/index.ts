import { findByProps, findByStoreName } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";

const DOUBLE_TAP_MS = 350;
let lastTap: { messageId: string; timestamp: number } | null = null;
const patches: (() => void)[] = [];

export default {
    onLoad() {
        const GestureHandlers = findByProps("TapGestureHandler");
        const ReplyActions = findByProps("createPendingReply");
        const ChannelStore = findByStoreName("ChannelStore");
        const MessageStore = findByStoreName("MessageStore");

        if (!ReplyActions || !ChannelStore || !MessageStore) {
            alert("[DTR] Missing modules");
            return;
        }

        // Patch TouchableOpacity/Pressable — Discord wraps each message in one
        // We detect double tap by timing consecutive presses on same message

        const { TouchableOpacity, Pressable } = GestureHandlers;

        // Patch Pressable's onPress
        patches.push(
            instead("render", Pressable.prototype ?? Pressable, (args, orig) => {
                const res = orig?.(...args);
                return res;
            })
        );

        // Instead, patch via findByProps for the message row component
        const MessageRecord = findByProps("getMessageRecord") 
            ?? findByProps("getRecord");

        // Use FluxDispatcher to watch for any action sheet open events
        const FluxDispatcher = findByProps("dispatch", "subscribe");

        const handler = (event: any) => {
            if (!event?.message) return;
            const { message } = event;
            const now = Date.now();

            if (lastTap && lastTap.messageId === message.id && now - lastTap.timestamp < DOUBLE_TAP_MS) {
                lastTap = null;
                const channel = ChannelStore.getChannel(message.channel_id);
                ReplyActions.createPendingReply({
                    message,
                    channel,
                    shouldMention: true,
                });
                return;
            }
            lastTap = { messageId: message.id, timestamp: now };
        };

        // Subscribe to context menu / action sheet open event
        FluxDispatcher.subscribe("CONTEXT_MENU_OPEN", handler);
        FluxDispatcher.subscribe("MESSAGE_ACTION_SHEET_OPEN", handler);
        FluxDispatcher.subscribe("BOTTOM_SHEET_PUSH", handler);

        (this as any)._handler = handler;
        (this as any)._dispatcher = FluxDispatcher;
    },

    onUnload() {
        patches.forEach(p => p?.());
        patches.length = 0;
        lastTap = null;
        const { _handler, _dispatcher } = this as any;
        if (_dispatcher && _handler) {
            _dispatcher.unsubscribe("CONTEXT_MENU_OPEN", _handler);
            _dispatcher.unsubscribe("MESSAGE_ACTION_SHEET_OPEN", _handler);
            _dispatcher.unsubscribe("BOTTOM_SHEET_PUSH", _handler);
        }
    },
};
