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
  | "coffee-refusal"
  | "empty-cup"
  | "apple-near"
  | "apple-far"
  | "apple-pair";

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
  motionDesign?: boolean;
  motionHeight?: number;
}> = ({ focus, localFrame, accent, motionDesign = false, motionHeight = 360 }) => {
  if (!focus) return null;

  if (focus === "coffee-refusal") {
    const refusal = interpolate(localFrame, [0, 10, 25], [0, 0.72, 1], {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    const handX = 442 + refusal * 48;
    const cupX = 520 + refusal * 55;
    const steamOpacity = 1 - refusal * 0.85;
    return (
      <svg
        viewBox="0 0 840 220"
        width="100%"
        height={motionHeight}
        role="img"
        aria-label="A person pushes a cup of coffee away"
      >
        <defs>
          <radialGradient id="coffee-refusal-glow">
            <stop offset="0" stopColor={accent} stopOpacity=".34" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="424" cy="148" rx="340" ry="84" fill="url(#coffee-refusal-glow)" />
        <path d="M93 194H758" stroke={accent} strokeOpacity=".52" strokeWidth="4" strokeLinecap="round" />
        <Figure x={225} baseline={194} scale={0.78} coat="#2FA06A" skin="#d9ad88" frame={localFrame} />
        <path
          d={`M252 133Q330 112 ${handX} 122`}
          fill="none"
          stroke="#2FA06A"
          strokeWidth="19"
          strokeLinecap="round"
        />
        <circle cx={handX} cy="122" r="15" fill="#d9ad88" stroke={COLORS.foreground} strokeWidth="3" />
        <path
          d={`M${handX} 111v-25m-10 29v-18m20 18V96m9 22v-17`}
          fill="none"
          stroke="#d9ad88"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <g transform={`translate(${cupX} ${135 + Math.sin(localFrame / 18) * 2}) rotate(${refusal * 8})`}>
          <ellipse cx="0" cy="63" rx="62" ry="9" fill="rgba(33,29,23,.16)" />
          <path d="M-42 -34H31L24 30Q22 43 9 43H-23Q-36 42 -37 29Z" fill="#FFF9F0" stroke={COLORS.foreground} strokeWidth="5" strokeLinejoin="round" />
          <path d="M-35 -19H28L24 1H-32Z" fill="#9C6138" />
          <path d="M31 -18H41Q61 -18 61 1Q61 19 40 19H28" fill="none" stroke={COLORS.foreground} strokeWidth="5" strokeLinecap="round" />
          <path d="M-50 51H49" stroke={accent} strokeWidth="7" strokeLinecap="round" />
          <g opacity={steamOpacity} fill="none" stroke={COLORS.muted} strokeOpacity=".66" strokeWidth="4" strokeLinecap="round">
            <path d="M-19 -43C-34 -57 -8 -65 -22 -82" />
            <path d="M8 -43C-7 -57 19 -65 5 -82" />
          </g>
        </g>
        <path
          d={`M${handX + 24} 122Q${handX + 58} 94 ${cupX - 70} 98`}
          fill="none"
          stroke={accent}
          strokeOpacity={refusal * 0.42}
          strokeWidth="3"
          strokeDasharray="7 10"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (motionDesign && focus.startsWith("apple-")) {
    const nearTarget = focus === "apple-near"
      ? 1.82
      : focus === "apple-far"
        ? 1.28
        : 1.58;
    const farTarget = focus === "apple-far"
      ? 1.04
      : focus === "apple-near"
        ? 0.7
        : 0.82;
    const nearScale = interpolate(
      localFrame,
      [0, 6, 22],
      [nearTarget * 0.76, nearTarget * 1.035, nearTarget],
      { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) },
    );
    const farScale = interpolate(
      localFrame,
      [0, 7, 21],
      [farTarget * 0.78, farTarget * 1.025, farTarget],
      { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) },
    );
    const nearOpacity = focus === "apple-far" ? 0.46 : 1;
    const farOpacity = focus === "apple-near" ? 0.58 : 1;
    const nearRing = interpolate(
      localFrame,
      [0, 10],
      [0.12, focus === "apple-near" ? 0.92 : focus === "apple-pair" ? 0.5 : 0.22],
      clamp,
    );
    const farRing = interpolate(
      localFrame,
      [0, 10],
      [0.12, focus === "apple-far" ? 0.94 : focus === "apple-pair" ? 0.58 : 0.2],
      clamp,
    );
    const pulse = 1 + Math.sin(localFrame / 15) * 0.015;
    const markerProgress = (localFrame % 60) / 60;
    const markerX = 274 + markerProgress * 286;
    const markerY = 265 - Math.sin(markerProgress * Math.PI) * 93;
    const motionId = `motion-apple-${focus}`;

    const renderApple = (
      x: number,
      y: number,
      scale: number,
      opacity: number,
      ringOpacity: number,
      ringColor: string,
      bob: number,
    ) => (
      <>
        <ellipse
          cx={x}
          cy={y + 105 * scale + bob}
          rx={53 * scale}
          ry={11 * scale}
          fill="rgba(33,29,23,.12)"
        />
        <ellipse
          cx={x}
          cy={y + 34 + bob}
          rx={89 * scale}
          ry={70 * scale}
          fill={`url(#${motionId}-halo)`}
          opacity={ringOpacity * 0.74}
        />
        <ellipse
          cx={x}
          cy={y + 34 + bob}
          rx={88 * scale}
          ry={68 * scale}
          fill="none"
          stroke={ringColor}
          strokeOpacity={ringOpacity}
          strokeWidth={3 * scale}
          strokeDasharray="8 12"
          strokeDashoffset={-localFrame * 0.8}
          transform={`rotate(${localFrame * 0.16} ${x} ${y + 34 + bob})`}
        />
        <g
          transform={`translate(${x} ${y + bob}) scale(${scale * pulse})`}
          opacity={opacity}
        >
          <path
            d="M0 12C-18 -5 -52 1 -58 31C-64 60 -42 91 -17 93C-7 94 -3 85 0 85C3 85 7 94 17 93C42 91 64 60 58 31C52 1 18 -5 0 12Z"
            fill={`url(#${motionId}-fruit)`}
            stroke="#74332d"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M0 11C-3 0 -1 -10 5 -18"
            fill="none"
            stroke="#47332b"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M5 -12C18 -27 37 -23 34 -8C22 -5 12 -6 5 -12Z"
            fill="#2FA06A"
            stroke="#244b37"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M-34 29C-39 40 -36 52 -31 58"
            fill="none"
            stroke="rgba(255,255,255,.78)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <ellipse cx="-22" cy="38" rx="12" ry="25" fill={`url(#${motionId}-shine)`} opacity=".56" />
        </g>
      </>
    );

    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: motionHeight,
          flexShrink: 0,
          margin: "-6px 0 0",
          overflow: "visible",
        }}
      >
        <svg
          viewBox="0 0 840 360"
          width="100%"
          height="100%"
          role="img"
          aria-label={focus === "apple-near" ? "Close apple in the foreground" : focus === "apple-far" ? "Small apple farther away" : "Two apples at different distances"}
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id={`${motionId}-fruit`} x1="0" y1="0" x2=".9" y2="1">
              <stop offset="0" stopColor="#ff8c77" />
              <stop offset=".46" stopColor="#ef5146" />
              <stop offset="1" stopColor="#b92f35" />
            </linearGradient>
            <radialGradient id={`${motionId}-shine`}>
              <stop offset="0" stopColor="#fff8df" stopOpacity=".82" />
              <stop offset="1" stopColor="#fff8df" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${motionId}-halo`}>
              <stop offset="0" stopColor={accent} stopOpacity=".3" />
              <stop offset="1" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${motionId}-distance`} x1="0" x2="1">
              <stop offset="0" stopColor="#2FA06A" stopOpacity=".12" />
              <stop offset=".55" stopColor="#E9A916" stopOpacity=".82" />
              <stop offset="1" stopColor="#E04A40" stopOpacity=".52" />
            </linearGradient>
          </defs>

          <path
            d="M244 273 C318 184 416 121 559 184"
            fill="none"
            stroke={`url(#${motionId}-distance)`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="1"
            pathLength="1"
            strokeDashoffset={interpolate(localFrame, [0, 26], [1, 0], clamp)}
          />
          <path
            d="M147 337 H710"
            fill="none"
            stroke="#665d50"
            strokeOpacity=".14"
            strokeWidth="2"
            strokeDasharray="3 12"
          />
          <circle cx="274" cy="265" r="7" fill="#2FA06A" opacity=".82" />
          <circle cx="560" cy="180" r="7" fill="#E04A40" opacity=".86" />
          <circle
            cx={markerX}
            cy={markerY}
            r="6"
            fill="#E9A916"
            opacity={interpolate(localFrame, [0, 6], [0, 0.95], clamp)}
          />

          {renderApple(
            274,
            230,
            farScale,
            farOpacity,
            farRing,
            "#2FA06A",
            Math.sin(localFrame / 14) * 2,
          )}
          {renderApple(
            560,
            145,
            nearScale,
            nearOpacity,
            nearRing,
            "#E04A40",
            Math.sin(localFrame / 12 + 1) * 3,
          )}
        </svg>
      </div>
    );
  }

  const entryFrames = visualSystem.motion.storyVisualEntryFrames;
  const initialOpacity = focus === "apple-pair" ? 0.58 : 0;
  const opacity = interpolate(
    localFrame,
    [0, entryFrames],
    [initialOpacity, 1],
    clamp,
  );
  const offset = interpolate(
    localFrame,
    [0, entryFrames],
    [visualSystem.motion.storyVisualStartOffsetPx, 0],
    clamp,
  );
  const dashOffset = -localFrame * 0.45;
  const scanOpacity = 0.58 + Math.sin(localFrame / 8) * 0.22;
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
                      : focus === "apple-near"
                        ? "Near and far apples, near one highlighted"
                        : focus === "apple-far"
                          ? "Near and far apples, far one highlighted"
                          : focus === "apple-pair"
                            ? "Near and far apples"
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

        {(focus === "apple-near" ||
          focus === "apple-far" ||
          focus === "apple-pair") && (
          <g>
            <path
              d="M176 178H666"
              stroke={COLORS.border}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M310 146Q418 78 536 129"
              fill="none"
              stroke={accent}
              strokeOpacity=".24"
              strokeWidth="3"
              strokeDasharray="5 11"
              strokeDashoffset={dashOffset}
            />
            <g
              transform={`translate(302 ${128 + Math.sin(localFrame / 24) * 2}) scale(${visualSystem.lessonLayout.appleFarScale})`}
              opacity={focus === "apple-near" ? 0.62 : 1}
            >
              <ellipse cx="0" cy="68" rx="39" ry="7" fill="rgba(33,29,23,.12)" />
              <path
                d="M0 12C-18 -5 -52 1 -58 31C-64 60 -42 91 -17 93C-7 94 -3 85 0 85C3 85 7 94 17 93C42 91 64 60 58 31C52 1 18 -5 0 12Z"
                fill={COLORS.brandRed}
                stroke={COLORS.foreground}
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <path
                d="M0 11C-3 0 -1 -10 5 -18"
                fill="none"
                stroke={COLORS.foreground}
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M5 -12C18 -27 37 -23 34 -8C22 -5 12 -6 5 -12Z"
                fill={COLORS.brandTeal}
                stroke={COLORS.foreground}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <path
                d="M-34 29C-39 40 -36 52 -31 58"
                fill="none"
                stroke="rgba(255,255,255,.64)"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </g>
            <g
              transform={`translate(548 ${104 + Math.sin(localFrame / 26 + 1) * 2}) scale(${visualSystem.lessonLayout.appleNearScale})`}
              opacity={focus === "apple-far" ? 0.62 : 1}
            >
              <ellipse cx="0" cy="68" rx="39" ry="7" fill="rgba(33,29,23,.12)" />
              <path
                d="M0 12C-18 -5 -52 1 -58 31C-64 60 -42 91 -17 93C-7 94 -3 85 0 85C3 85 7 94 17 93C42 91 64 60 58 31C52 1 18 -5 0 12Z"
                fill={COLORS.brandRed}
                stroke={COLORS.foreground}
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <path
                d="M0 11C-3 0 -1 -10 5 -18"
                fill="none"
                stroke={COLORS.foreground}
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M5 -12C18 -27 37 -23 34 -8C22 -5 12 -6 5 -12Z"
                fill={COLORS.brandTeal}
                stroke={COLORS.foreground}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <path
                d="M-34 29C-39 40 -36 52 -31 58"
                fill="none"
                stroke="rgba(255,255,255,.64)"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </g>
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
