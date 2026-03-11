const CACHE_NAME = "paperclip-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and API calls
  if (request.method !== "GET" || url.pathname.startsWith("/api")) {
    return;
  }

  // Network-first for everything — cache is only an offline fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        if (request.mode === "navigate") {
          return caches.match("/") || new Response("Offline", { status: 503 });
        }
        return caches.match(request);
      })
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.error("Push event received but no data");
    return;
  }

  let notificationData = {
    title: "Paperclip",
    body: "New notification",
    icon: "/paperclip.png",
    badge: "/paperclip-badge.png",
    tag: "paperclip-notification",
    requireInteraction: false,
  };

  try {
    const payload = event.data.json();
    notificationData = {
      ...notificationData,
      ...payload,
    };
  } catch (e) {
    // If payload is not JSON, use it as the body
    notificationData.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data || {},
    })
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || "/";

  // Open or focus the application window
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      // Check if window is already open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window if not found
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Notification close handler (for analytics if needed)
self.addEventListener("notificationclose", (event) => {
  // Optional: track closed notifications for analytics
  console.debug("Notification closed", event.notification.tag);
});
