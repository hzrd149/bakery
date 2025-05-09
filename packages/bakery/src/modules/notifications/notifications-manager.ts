import { NostrEvent, kinds } from "nostr-tools";
import { npubEncode } from "nostr-tools/nip19";
import { getDisplayName, unixNow } from "applesauce-core/helpers";
import EventEmitter from "events";
import webPush from "web-push";

import { logger } from "../../logger.js";
import App from "../../app/index.js";
import stateManager from "../../services/app-state.js";
import bakeryConfig from "../../services/bakery-config.js";
import { getDMRecipient, getDMSender } from "../../helpers/direct-messages.js";

type BaseChannel = {
  id: string;
  type: string;
  device?: string;
};
export type WebPushChannel = BaseChannel & {
  type: "web";
  endpoint: string;
  expirationTime: PushSubscriptionJSON["expirationTime"];
  keys: {
    p256dh: string;
    auth: string;
  };
};
export type NtfyChannel = BaseChannel & {
  type: "ntfy";
  server: string;
  topic: string;
};
export type NotificationChannel = WebPushChannel | NtfyChannel;
type NotificationsRegister = ["CONTROL", "NOTIFICATIONS", "REGISTER", NotificationChannel];
type NotificationsUnregister = ["CONTROL", "NOTIFICATIONS", "UNREGISTER", string];
type NotificationsNotify = ["CONTROL", "NOTIFICATIONS", "NOTIFY", string];
type NotificationsGetVapidKey = ["CONTROL", "NOTIFICATIONS", "GET-VAPID-KEY"];
type NotificationsVapidKey = ["CONTROL", "NOTIFICATIONS", "VAPID-KEY", string];
export type NotificationsMessage =
  | NotificationsRegister
  | NotificationsUnregister
  | NotificationsNotify
  | NotificationsGetVapidKey;
export type NotificationsResponse = NotificationsVapidKey;
export type WebPushNotification = {
  title: string;
  body: string;
  icon: string;
  url: string;
  event: NostrEvent;
};
export type NotificationType = WebPushNotification;

export type NotificationsManagerState = {
  channels: NotificationChannel[];
};

type EventMap = {
  addChannel: [NotificationChannel];
  updateChannel: [NotificationChannel];
  removeChannel: [NotificationChannel];
};

export default class NotificationsManager extends EventEmitter<EventMap> {
  log = logger.extend("Notifications");
  app: App;
  lastRead: number = unixNow();

  webPushKeys: webPush.VapidKeys = webPush.generateVAPIDKeys();

  state: NotificationsManagerState = { channels: [] };

  get channels() {
    return this.state.channels;
  }

  constructor(app: App) {
    super();
    this.app = app;
  }

  async setup() {
    this.state = stateManager.getMutableState<NotificationsManagerState>("notification-manager", {
      channels: [],
    });
  }

  addOrUpdateChannel(channel: NotificationChannel) {
    if (this.state.channels.some((c) => c.id === channel.id)) {
      // update channel
      this.log(`Updating channel ${channel.id} (${channel.type})`);
      this.state.channels = this.state.channels.map((c) => {
        if (c.id === channel.id) return channel;
        else return c;
      });
      this.emit("updateChannel", channel);
    } else {
      // add channel
      this.log(`Added new channel ${channel.id} (${channel.type})`);
      this.state.channels = [...this.state.channels, channel];
      this.emit("addChannel", channel);
    }
  }
  removeChannel(id: string) {
    const channel = this.state.channels.find((s) => s.id === id);
    if (channel) {
      this.log(`Removed channel ${id}`);
      this.state.channels = this.state.channels.filter((s) => s.id !== id);
      this.emit("removeChannel", channel);
    }
  }

  /** Whether a notification should be sent */
  shouldNotify(event: NostrEvent) {
    if (event.kind !== kinds.EncryptedDirectMessage) return;
    if (getDMRecipient(event) !== bakeryConfig.data.owner) return;

    if (event.created_at > this.lastRead) return true;
  }

  /** builds a notification based on a nostr event */
  async buildNotification(event: NostrEvent) {
    // TODO in the future we might need to build special notifications for channel type
    switch (event.kind) {
      case kinds.EncryptedDirectMessage:
        const sender = getDMSender(event);
        const senderProfile = await this.app.profileBook.loadProfile(sender);
        const senderName = senderProfile ? (getDisplayName(senderProfile) ?? "Unknown") : "Unknown";

        return {
          kind: event.kind,
          event,
          senderName,
          senderProfile,
          title: `Message from ${senderName}`,
          body: "Tap on notification to read",
          icon: "https://app.satellite.earth/logo-64x64.png",
          // TODO: switch this to a satellite:// link once the native app supports it
          url: `https://app.satellite.earth/messages/p/${npubEncode(sender)}`,
        };
    }
  }

  async notify(event: NostrEvent) {
    const notification = await this.buildNotification(event);
    if (!notification) return;

    this.log(`Sending notification for ${event.id} to ${this.state.channels.length} channels`);

    for (const channel of this.state.channels) {
      this.log(`Sending notification "${notification.title}" to ${channel.id} (${channel.type})`);
      try {
        switch (channel.type) {
          case "web":
            const pushNotification: WebPushNotification = {
              title: notification.title,
              body: notification.body,
              icon: notification.icon,
              url: notification.url,
              event: notification.event,
            };

            await webPush.sendNotification(channel, JSON.stringify(pushNotification), {
              vapidDetails: {
                subject: "mailto:admin@example.com",
                publicKey: this.webPushKeys.publicKey,
                privateKey: this.webPushKeys.privateKey,
              },
            });
            break;

          case "ntfy":
            const headers: HeadersInit = {
              Title: notification.title,
              Icon: notification.icon,
              Click: notification.url,
            };

            await fetch(new URL(channel.topic, channel.server), {
              method: "POST",
              body: notification.body,
              headers,
            }).then((res) => res.text());
            break;

          default:
            // @ts-expect-error
            throw new Error(`Unknown channel type ${channel.type}`);
        }
      } catch (error) {
        this.log(`Failed to notification ${channel.id} (${channel.type})`);
        this.log(error);
      }
    }
  }
}
