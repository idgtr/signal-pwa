// sw.js
// Service worker: gira in background, riceve le notifiche push anche a
// app chiusa, e gestisce il tap sulla notifica per riaprire l'app.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Arriva una push dal backend (inviata da main.py alla ricezione di un
// nuovo segnale da TradingView)
self.addEventListener("push", (event) => {
  let data = { title: "Nuovo segnale", body: "" };
  try {
    data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: "./index.html" },
  };

  event.waitUntil(self.registration.showNotification(data.title || "Segnale", options));
});

// Tap sulla notifica -> apre (o porta in primo piano) l'app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});
