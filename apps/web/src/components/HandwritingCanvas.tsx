import { useEffect, useRef, useState } from "react";

type Props = {
  onChanged: (drawn: boolean) => void;
};

export function HandwritingCanvas({ onChanged }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#2d2d2d";
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
    ctx.fillStyle = "#2d2d2d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    onChanged(false);
  };

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Handwriting</strong>
        <button className="secondary" onClick={clearCanvas}>
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={640}
        height={320}
        style={{ width: "100%", borderRadius: 12 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </div>
  );
}
