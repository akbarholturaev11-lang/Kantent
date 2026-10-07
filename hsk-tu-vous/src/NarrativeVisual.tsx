import { Easing, interpolate } from "remotion";
import visualSystem from "../content/visual-system.json";

export type VisualFocus =
  | "friend"
  | "teacher"
  | "elder"
  | "shopkeeper"
  | "group"
  | "single-person"
  | "book"
  | "person-with-book"
  | "coffee"
  | "empty-cup";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const Figure: React.FC<{
  x: number;
  baseline: number;
  scale?: number;
  coat: string;
  skin: string;
  hair?: string;
  frame: number;
  delay?: number;
  phase?: number;
}> = ({
  x,
  baseline,
  scale = 1,
  coat,
  skin,
  hair = "#211D17",
  frame,
  delay = 0,
  phase = 0,
}) => {
  const entry = interpolate(frame, [delay, delay + 11], [0.68, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const opacity = interpolate(frame, [delay, delay + 8], [0, 1], clamp);
  const lift = interpolate(frame, [delay, delay + 11], [18, 0], clamp);
  const bob =
    frame < delay + 11
      ? 0
      : Math.sin((frame - delay + phase) / 10) *
        visualSystem.motion.storyVisualBobAmplitudePx;
  const tilt = frame < delay + 11
    ? 0
    : Math.sin((frame + phase) / 15) * visualSystem.motion.maxCardTiltDeg;

  return (
    <g
      transform={`translate(${x} ${baseline + lift + bob}) rotate(${tilt}) scale(${scale * entry})`}
      opacity={opacity}
    >
      <ellipse cx="0" cy="1" rx="52" ry="10" fill="rgba(0,0,0,.24)" />
      <path
        d="M-47 -18 Q-44 -71 -28 -86 L-14 -96 L14 -96 L28 -86 Q44 -71 47 -18 L32 -12 L27 -58 L22 -17 L-22 -17 L-27 -58 L-32 -12 Z"
        fill={coat}
      />
      <path
        d="M-15 -89 L0 -74 L15 -89 L9 -17 L-9 -17 Z"
        fill="rgba(253,249,240,.28)"
      />
      <rect x="-9" y="-119" width="18" height="24" rx="7" fill={skin} />
      <ellipse cx="0" cy="-139" rx="31" ry="38" fill={skin} />
      <path
        d="M-31 -139 Q-33 -177 0 -177 Q33 -177 31 -139 L23 -151 Q0 -162 -22 -149 Z"
        fill={hair}
      />
      <path
        d="M-28 -128 Q-35 -113 -23 -108 L-18 -124 Z M28 -128 Q35 -113 23 -108 L18 -124 Z"
        fill={hair}
      />
    </g>
  );
};

export const NarrativeVisual: React.FC<{
  focus?: VisualFocus;
  localFrame: number;
  accent: string;
}> = ({ focus, localFrame, accent }) => {
  if (!focus) return null;

  const entryFrames = visualSystem.motion.storyVisualEntryFrames;
  const opacity = interpolate(localFrame, [0, entryFrames], [0, 1], clamp);
  const offset = interpolate(
    localFrame,
    [0, entryFrames],
    [visualSystem.motion.storyVisualStartOffsetPx, 0],
    clamp,
  );
  const dashOffset = -localFrame * 0.45;
  const orbitRotation = localFrame * 0.22;
  const orbitRadius = 102 + Math.sin(localFrame / 22) * 2;

  const label =
    focus === "shopkeeper"
      ? "Animated shop scene"
      : focus === "teacher"
        ? "Animated teacher scene"
        : focus === "elder"
          ? "Animated older person scene"
          : focus === "group"
            ? "Animated group scene"
          : focus === "single-person"
              ? "Animated single person scene"
              : focus === "book"
                ? "Illustrated book"
                : focus === "person-with-book"
                  ? "Person holding a book"
                  : focus === "coffee"
                    ? "Cup of coffee"
                    : focus === "empty-cup"
                      ? "Empty cup"
              : "Animated friends scene";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: visualSystem.motion.storyVisualHeightPx,
        flexShrink: 0,
        margin: "2px 0 5px",
        opacity,
        translate: `0 ${offset}px`,
        scale: interpolate(localFrame, [0, entryFrames + 4], [0.96, 1], {
          ...clamp,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      <svg
        viewBox="0 0 840 220"
        width="100%"
        height="100%"
        role="img"
        aria-label={label}
      >
        <defs>
          <radialGradient id={`scene-glow-${focus}`}>
            <stop offset="0" stopColor={accent} stopOpacity=".3" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx="420"
          cy="116"
          rx="310"
          ry="118"
          fill={`url(#scene-glow-${focus})`}
        />
        <circle
          cx="420"
          cy="112"
          r={orbitRadius}
          fill="none"
          stroke={accent}
          strokeOpacity=".18"
          strokeWidth="2"
          strokeDasharray="3 13"
          strokeDashoffset={dashOffset}
          transform={`rotate(${orbitRotation} 420 112)`}
        />
        <path
          d="M70 202H770"
          stroke={accent}
          strokeOpacity=".4"
          strokeWidth="2"
          strokeDasharray="16 11"
          strokeDashoffset={dashOffset}
        />

        {focus === "book" && (
          <g
            transform={`translate(420 112) scale(${interpolate(localFrame, [0, 12], [0.94, 1], {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}) translate(-420 -112)`}
          >
            <path
              d="M420 78C385 57 343 58 304 73V161C345 147 385 149 420 170Z"
              fill="#FFFFFF"
              stroke={COLORS.foreground}
              strokeWidth="7"
              strokeLinejoin="round"
            />
            <path
              d="M420 78C455 57 497 58 536 73V161C495 147 455 149 420 170Z"
              fill="#FFFFFF"
              stroke={COLORS.foreground}
              strokeWidth="7"
              strokeLinejoin="round"
            />
            <path d="M420 78V170" stroke={accent} strokeWidth="7" strokeLinecap="round" />
            <path d="M328 94Q368 84 399 100M328 116Q368 106 399 122M441 100Q472 84 512 94M441 122Q472 106 512 116" fill="none" stroke={COLORS.border} strokeWidth="5" strokeLinecap="round" />
            <path d="M304 73V161M536 73V161" stroke={accent} strokeOpacity=".65" strokeWidth="4" />
          </g>
        )}

        {focus === "person-with-book" && (
          <>
            <Figure x={350} baseline={202} scale={0.82} coat="#2FA06A" skin="#d9ad88" frame={localFrame} />
            <path d="M370 132Q402 119 433 132M370 143Q402 153 433 141" fill="none" stroke="#d9ad88" strokeWidth="11" strokeLinecap="round" />
            <g transform={`translate(474 ${119 + Math.sin(localFrame / 22) * 2})`}>
              <path d="M-37 -34Q-8 -43 0 -30V35Q-16 23 -37 32Z" fill="#FFFFFF" stroke={COLORS.foreground} strokeWidth="5" strokeLinejoin="round" />
              <path d="M0 -30Q12 -43 37 -34V32Q15 23 0 35Z" fill="#FFFFFF" stroke={COLORS.foreground} strokeWidth="5" strokeLinejoin="round" />
              <path d="M0 -30V35" stroke={accent} strokeWidth="4" />
              <path d="M-26 -20L-8 -23M-26 -8L-8 -11M8 -23L27 -20M8 -11L27 -8" stroke={COLORS.border} strokeWidth="3" strokeLinecap="round" />
            </g>
          </>
        )}

        {(focus === "coffee" || focus === "empty-cup") && (
          <g transform={`translate(420 ${110 + Math.sin(localFrame / 24) * 2})`}>
            <path d="M-84 10H60L47 78Q42 96 23 96H-48Q-67 92 -72 75Z" fill="#FFFFFF" stroke={COLORS.foreground} strokeWidth="8" strokeLinejoin="round" />
            {focus === "coffee" && (
              <path d="M-68 25H47L37 54H-58Z" fill="#9C6138" />
            )}
            <path d="M60 27H80Q106 27 106 51Q106 75 75 75H52" fill="none" stroke={COLORS.foreground} strokeWidth="8" strokeLinecap="round" />
            <path d="M-91 101H63" stroke={accent} strokeWidth="7" strokeLinecap="round" />
            {focus === "coffee" && (
              <>
                <path d="M-25 -8C-41 -23 -12 -29 -26 -48M8 -8C-8 -23 21 -29 7 -48" fill="none" stroke={COLORS.muted} strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" />
              </>
            )}
            {focus === "empty-cup" && (
              <path d="M-40 65Q-7 55 29 65" fill="none" stroke={COLORS.border} strokeWidth="4" strokeLinecap="round" />
            )}
          </g>
        )}

        {focus === "shopkeeper" && (
          <>
            <path
              d="M142 32H344V138H142Z"
              fill="rgba(7,12,22,.35)"
              stroke="rgba(102,93,80,.18)"
              strokeWidth="2"
            />
            <path d="M142 84H344 M243 32V138" stroke="rgba(102,93,80,.18)" strokeWidth="2" />
            <rect x="166" y="50" width="34" height="27" rx="7" fill={`${accent}c8`} />
            <rect
              x="268"
              y={94 + Math.sin(localFrame / 5) * 4}
              width="40"
              height="28"
              rx="6"
              fill="#E9A916"
              opacity=".9"
            />
            <path d="M370 148H704V192H370Z" fill="#6a4937" />
            <path d="M370 148H704V159H370Z" fill="#E9A916" />
            <Figure x={544} baseline={194} scale={0.78} coat="#2FA06A" skin="#d9ad88" frame={localFrame} delay={4} />
            <path d="M387 194V211 M685 194V211" stroke="#52382d" strokeWidth="9" />
          </>
        )}

        {focus === "teacher" && (
          <>
            <rect
              x="120"
              y="26"
              width="310"
              height="126"
              rx="14"
              fill="rgba(21,61,58,.5)"
              stroke="rgba(102,93,80,.22)"
              strokeWidth="2"
            />
            <path
              d="M150 62H318 M150 84H280 M150 124H344"
              stroke={COLORS.foreground}
              strokeOpacity={scanOpacity}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="190"
              strokeDashoffset={interpolate(localFrame, [0, 14], [190, 0], clamp)}
            />
            <path
              d={`M${498 + Math.sin(localFrame / 6) * 3} 114L430 104`}
              stroke="#E9A916"
              strokeWidth="6"
              strokeLinecap="round"
              opacity={interpolate(localFrame, [0, 10], [0, 1], clamp)}
            />
            <Figure x={600} baseline={200} scale={0.8} coat="#75485a" skin="#d5ac8c" hair="#d9d4c8" frame={localFrame} delay={3} />
          </>
        )}

        {focus === "elder" && (
          <>
            <circle cx="420" cy="106" r="112" fill="rgba(33,29,23,.025)" />
            <Figure x={420} baseline={200} scale={0.9} coat="#52647e" skin="#d1aa8b" hair="#e4dfd4" frame={localFrame} />
            <path
              d={`M510 151V198Q510 207 522 207H532`}
              fill="none"
              stroke="#E9A916"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray="80"
              strokeDashoffset={interpolate(localFrame, [0, 12], [80, 0], clamp)}
            />
          </>
        )}

        {focus === "single-person" && (
          <>
            <circle
              cx="420"
              cy="109"
              r={orbitRadius}
              fill="rgba(33,29,23,.025)"
              stroke={accent}
              strokeOpacity=".3"
              strokeWidth="2"
              strokeDasharray="4 10"
              strokeDashoffset={dashOffset}
            />
            <Figure x={420} baseline={202} scale={0.78} coat="#52647e" skin="#d1aa8b" frame={localFrame} />
            <circle cx="531" cy="48" r="24" fill={accent} opacity=".94" />
            <text x="531" y="57" textAnchor="middle" fill="#FFFFFF" fontFamily="sans-serif" fontSize="26" fontWeight="800">1</text>
          </>
        )}

        {focus === "friend" && (
          <>
            <path
              d="M340 58Q420 15 500 58"
              fill="none"
              stroke={accent}
              strokeWidth="3"
              strokeDasharray="5 9"
              strokeDashoffset={dashOffset}
            />
            <circle cx={420 + Math.sin(localFrame / 5) * 70} cy="43" r="5" fill={accent} opacity={scanOpacity} />
            <Figure x={345} baseline={202} scale={0.75} coat="#E04A40" skin="#d9ad88" frame={localFrame} phase={1} />
            <Figure x={495} baseline={202} scale={0.75} coat="#2FA06A" skin="#bb8868" hair="#342c31" frame={localFrame} delay={4} phase={4} />
          </>
        )}

        {focus === "group" && (
          <>
            <path
              d="M300 60Q420 2 540 60"
              fill="none"
              stroke={accent}
              strokeWidth="3"
              strokeDasharray="4 9"
              strokeDashoffset={dashOffset}
            />
            <Figure x={300} baseline={202} scale={0.65} coat="#E04A40" skin="#d9ad88" frame={localFrame} phase={1} />
            <Figure x={420} baseline={202} scale={0.77} coat="#2FA06A" skin="#c99475" hair="#342c31" frame={localFrame} delay={4} phase={4} />
            <Figure x={540} baseline={202} scale={0.65} coat="#E9A916" skin="#e0b791" hair="#5e4a3c" frame={localFrame} delay={8} phase={7} />
          </>
        )}
      </svg>
    </div>
  );
};

const COLORS = visualSystem.colors;
