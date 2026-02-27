import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { hardRefreshForPwaUpdate, subscribeToPwaUpdates } from "../pwa";

export function PwaUpdateBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    return subscribeToPwaUpdates(() => {
      setVisible(true);
    });
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed left-1/2 top-4 z-[10001] w-[min(calc(100vw-2rem),32rem)] -translate-x-1/2 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-card)]/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-stretch">
        <p className="m-0 flex-1 text-sm text-text-primary">{t("pwa.update_available")}</p>
        <button
          type="button"
          className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold"
          onClick={async () => {
            setRefreshing(true);
            await hardRefreshForPwaUpdate();
          }}
          disabled={refreshing}
        >
          {refreshing ? t("pwa.refreshing") : t("pwa.refresh_now")}
        </button>
      </div>
    </div>
  );
}
