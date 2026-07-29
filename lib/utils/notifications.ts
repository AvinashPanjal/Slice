/**
 * Web Push & Native OS Notification Utility
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    alert('Notifications are not supported in this browser environment.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function sendLocalNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          ...options,
        } as any);
      });
    } else {
      new Notification(title, {
        icon: '/icons/icon-192.png',
        ...options,
      });
    }
  }
}

export function triggerDueReminderAlert(pendingCount: number, pendingAmountFormatted: string) {
  if (pendingCount <= 0) return;
  sendLocalNotification('🔔 LendWise Payment Reminder Alert', {
    body: `You have ${pendingCount} monthly dues pending totaling ${pendingAmountFormatted}. Check the dashboard to mark paid or send WhatsApp reminders!`,
    tag: 'lendwise-due-alert',
  });
}
