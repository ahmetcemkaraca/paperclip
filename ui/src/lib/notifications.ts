/**
 * Web Push Notifications utility
 * Handles Service Worker registration, notification permissions, and subscriptions
 */

export interface NotificationSubscriptionResponse {
  success: boolean;
  message: string;
  subscriptionId?: string;
}

/**
 * Check if the browser supports notifications
 */
export function isNotificationsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

/**
 * Get the current notification permission state
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationsSupported()) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Register Service Worker (if not already registered)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.debug("Service Worker registered", registration);
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    throw error;
  }
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationsSupported()) {
    throw new Error("Notifications not supported");
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  vapidPublicKey: string
): Promise<PushSubscription> {
  // Ensure Service Worker is registered
  const registration = await registerServiceWorker();
  if (!registration) {
    throw new Error("Service Worker registration required");
  }

  // Request permission if not already granted
  if (Notification.permission !== "granted") {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission denied");
    }
  }

  // Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  return subscription;
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return await subscription.unsubscribe();
    }
    return false;
  } catch (error) {
    console.error("Failed to unsubscribe:", error);
    throw error;
  }
}

/**
 * Get the current push subscription
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error("Failed to get subscription:", error);
    return null;
  }
}

/**
 * Send subscription to server
 */
export async function sendSubscriptionToServer(
  companyId: string,
  subscription: PushSubscription
): Promise<NotificationSubscriptionResponse> {
  const p256dhKey = subscription.getKey("p256dh") as Uint8Array | null;
  const authKey = subscription.getKey("auth") as Uint8Array | null;

  const response = await fetch(`/api/companies/${companyId}/notifications/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscription: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(p256dhKey),
          auth: arrayBufferToBase64(authKey),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to subscribe: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Helper: Convert URL-safe Base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Helper: Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array | null | undefined): string {
  if (!buffer) {
    return "";
  }

  let bytes: Uint8Array;
  if (buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(buffer);
  } else if (buffer instanceof Uint8Array) {
    bytes = buffer;
  } else {
    bytes = buffer as Uint8Array;
  }

  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Fetch VAPID public key from server
 */
export async function fetchVapidPublicKey(): Promise<string> {
  try {
    const response = await fetch("/api/notifications/vapid-public-key");
    if (!response.ok) {
      throw new Error(`Failed to fetch VAPID public key: ${response.statusText}`);
    }
    const data = (await response.json()) as { vapidPublicKey: string };
    return data.vapidPublicKey;
  } catch (error) {
    console.error("Failed to fetch VAPID public key:", error);
    throw error;
  }
}
