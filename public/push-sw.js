self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'New Job Alert!';
  const options = {
    body: data.body || 'A new job matches your profile.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: {
      url: data.url,
    },
    actions: [
      { action: 'apply', title: 'Apply Now' },
      { action: 'ignore', title: 'Ignore' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  if (event.action === 'apply' && event.notification.data.url) {
    // When the user clicks Apply Now on the notification,
    // open the PWA and trigger the apply API.
    event.waitUntil(
      clients.openWindow('/?applyUrl=' + encodeURIComponent(event.notification.data.url))
    );
  } else if (event.notification.data.url) {
    // Just click the notification body to view the job
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
