import type { DashboardPage } from "../../../shared/types/dashboard";

// A lightweight preview of the saved document, without mounting chart editors.
export function DocumentPreview({ page }: { page: DashboardPage }) {
  return (
    <svg
      viewBox="0 0 1280 760"
      className="document-preview"
      aria-label={`Preview of ${page.title}`}
      role="img"
    >
      <rect width="1280" height="760" fill={page.background || "#fff"} />
      {[...page.elements]
        .filter((e) => !e.hidden)
        .sort((a, b) => a.layout.zIndex - b.layout.zIndex)
        .map((element) => {
          const { x, y, width, height } = element.layout;
          return (
            <g key={element.id} opacity={element.style.opacity / 100}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={
                  element.type === "circle"
                    ? Math.min(width, height) / 2
                    : element.style.borderRadius
                }
                fill={element.style.fill || "transparent"}
              />
              {element.type === "text" &&
                element.content.split("\n").map((line, index) => (
                  <text
                    key={index}
                    x={x + element.style.padding}
                    y={
                      y +
                      element.style.padding +
                      element.style.fontSize +
                      index * element.style.fontSize * element.style.lineHeight
                    }
                    fontFamily={element.style.fontFamily}
                    fontSize={element.style.fontSize}
                    fontWeight={element.style.fontWeight}
                    fill={element.style.textColor}
                  >
                    {line.slice(0, 110)}
                  </text>
                ))}
              {element.type === "image" && element.content && (
                <image
                  href={element.content}
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  preserveAspectRatio="xMidYMid slice"
                />
              )}
            </g>
          );
        })}
      {page.tiles
        .filter((t) => !t.hidden)
        .map((tile) => {
          const { x, y, width, height } = tile.layout;
          const rows = tile.result.table;
          const column = tile.result.columns[0];
          const radius = Math.min(width, height) * 0.23;
          const circumference = 2 * Math.PI * radius;
          const total = rows.reduce(
            (sum, row) => sum + (column ? row.values[column.id] : 0),
            0,
          );
          let offset = 0;
          return (
            <g key={tile.id}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={tile.appearance.borderRadius}
                fill={tile.appearance.background}
              />
              <text
                x={x + 24}
                y={y + 34}
                fontFamily="sans-serif"
                fontSize="18"
                fontWeight="600"
                fill="#263e34"
              >
                {tile.title}
              </text>
              {tile.visualization === "donut" ? (
                <g
                  transform={`translate(${x + width / 2} ${y + height / 2 + 14}) rotate(-90)`}
                >
                  {rows.map((row, i) => {
                    const length = total
                      ? (circumference * (column ? row.values[column.id] : 0)) /
                        total
                      : 0;
                    const start = offset;
                    offset += length;
                    return (
                      <circle
                        key={row.optionId}
                        r={radius}
                        fill="none"
                        stroke={
                          tile.appearance.palette[
                            i % tile.appearance.palette.length
                          ] || tile.appearance.primaryColor
                        }
                        strokeWidth="36"
                        strokeDasharray={`${length} ${circumference}`}
                        strokeDashoffset={-start}
                      />
                    );
                  })}
                </g>
              ) : (
                rows.slice(0, 6).map((row, i) => {
                  const barHeight = Math.min(
                    28,
                    (height - 100) / rows.length - 12,
                  );
                  const value = column ? row.values[column.id] : 0;
                  return (
                    <g key={row.optionId}>
                      <rect
                        x={x + width * 0.36}
                        y={y + 75 + i * (barHeight + 18)}
                        width={Math.max(3, (width * 0.52 * value) / 100)}
                        height={barHeight}
                        rx="4"
                        fill={
                          tile.appearance.palette[
                            i % tile.appearance.palette.length
                          ] || tile.appearance.primaryColor
                        }
                      />
                      <text
                        x={x + 20}
                        y={y + 75 + i * (barHeight + 18) + barHeight * 0.7}
                        fontSize="12"
                        fill="#53665a"
                      >
                        {(
                          tile.appearance.axisLabelOverrides[row.optionId] ||
                          row.label
                        ).slice(0, 27)}
                      </text>
                    </g>
                  );
                })
              )}
            </g>
          );
        })}
    </svg>
  );
}
