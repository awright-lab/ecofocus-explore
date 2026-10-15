import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { canvasHeight, canvasWidth } from "../builderConstants";

export function PublishedCanvas({
  background,
  children,
}: {
  background: CSSProperties;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(
        Math.min(
          1,
          Math.max(0.15, (entry.contentRect.width - 12) / canvasWidth),
        ),
      ),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="published-stage-scroll" ref={viewport}>
      <div
        className="published-zoom-shell"
        style={{ width: canvasWidth * scale, height: canvasHeight * scale }}
      >
        <div
          className="published-canvas"
          style={{
            ...background,
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
