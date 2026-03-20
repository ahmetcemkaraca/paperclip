import { api } from "../api/client";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

export function isNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof Notification === "undefined") return "default";
  return Notification.permission;
}

export async function getPushSubscription() {
  if (!isNotificationsSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPushNotifications(vapidPublicKey: string) {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
  });
}

export async function unsubscribeFromPushNotifications() {
  const subscription = await getPushSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
}

export async function sendSubscriptionToServer(companyId: string, subscription: PushSubscription) {
  return api.post(`/companies/${companyId}/push-subscriptions`, subscription.toJSON());
}

export async function fetchVapidPublicKey() {
  const response = await api.get<{ publicKey: string }>("/notifications/vapid-public-key");
  return response.publicKey;
}
