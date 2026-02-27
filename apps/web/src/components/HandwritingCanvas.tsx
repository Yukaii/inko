import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  onChanged: (drawn: boolean) => void;
};

export function HandwritingCanvas({ onChanged }: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rootStyles = getComputedStyle(document.documentElement);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = rootStyles.getPropertyValue("--text-primary").trim() || "#ffffff";
    ctx.fillStyle = rootStyles.getPropertyValue("--bg-elevated").trim() || "#2d2d2d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const pointerPos = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = pointerPos(event);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = pointerPos(event);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (!hasStrokes) {
      setHasStrokes(true);
      onChanged(true);
    }
  };

  const onPointerUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rootStyles = getComputedStyle(document.documentElement);
    ctx.fillStyle = rootStyles.getPropertyValue("--bg-elevated").trim() || "#2d2d2d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    onChanged(false);
  };

  return (
    <div className="grid gap-3 rounded-base bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <strong>{t("common.handwriting")}</strong>
        <button className="bg-bg-elevated text-text-primary" onClick={clearCanvas}>
          {t("common.clear")}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={640}
        height={320}
        className="w-full rounded-xl"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </div>
  );
}
