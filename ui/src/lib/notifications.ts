import { api } from "../api/client";

type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function isNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export function getNotificationPermission(): NotificationPermission {
  return typeof window === "undefined" || !("Notification" in window) ? "denied" : Notification.permission;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isNotificationsSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPushNotifications(vapidPublicKey: string): Promise<PushSubscriptionJSON> {
  if (!isNotificationsSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }

  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  return subscription.toJSON() as unknown as PushSubscriptionJSON;
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  const subscription = await getPushSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
}

export async function fetchVapidPublicKey(): Promise<string> {
  const response = await api.get<{ publicKey: string }>("/notifications/vapid-public-key");
  return response.publicKey;
}

export async function sendSubscriptionToServer(companyId: string, subscription: PushSubscriptionJSON): Promise<void> {
  await api.post(`/companies/${companyId}/notifications/subscriptions`, { subscription });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
