import { registerSW } from "virtual:pwa-register";

const PWA_UPDATE_EVENT = "inko:pwa-update";

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;
let updateReady = false;

function notifyUpdateReady() {
  updateReady = true;
  window.dispatchEvent(new Event(PWA_UPDATE_EVENT));
}

export function initPwaRegistration() {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateServiceWorker = updateSW;
      notifyUpdateReady();
    },
  });
}

export function subscribeToPwaUpdates(listener: () => void) {
  if (updateReady) {
    listener();
  }

  window.addEventListener(PWA_UPDATE_EVENT, listener);
  return () => {
    window.removeEventListener(PWA_UPDATE_EVENT, listener);
  };
}

export async function hardRefreshForPwaUpdate() {
  try {
    await updateServiceWorker?.(true);
  } finally {
    window.location.reload();
  }
}
