import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import "./index.css";

const FPS = 30;
const DURATION = 30 * FPS;
const CLAMP = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

type SceneProps = {
  index: number;
  title: string;
  duration: number;
};

const show = (frame: number, delay = 0): React.CSSProperties => ({
  opacity: interpolate(frame, [delay, delay + 12], [0, 1], {
    ...CLAMP,
    easing: ease,
  }),
  translate:
    "0px " +
    interpolate(frame, [delay, delay + 14], [32, 0], {
      ...CLAMP,
      easing: ease,
    }) +
    "px",
});

const Background = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(circle at 92% 15%, rgba(224, 74, 64, 0.13), transparent 25%), radial-gradient(circle at 8% 86%, rgba(47, 160, 106, 0.10), transparent 23%), #FDF9F0",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 205,
        right: -125,
        width: 310,
        height: 310,
        borderRadius: "50%",
        border: "2px solid rgba(33, 29, 23, 0.06)",
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: 155,
        left: -76,
        width: 190,
        height: 190,
        borderRadius: "50%",
        background: "rgba(233, 169, 22, 0.13)",
      }}
    />
  </AbsoluteFill>
);

const Header: React.FC<SceneProps & { frame: number }> = ({
  index,
  title,
  duration,
  frame,
}) => {
  const lengths = [90, 150, 300, 210, 150];
  return (
    <div style={{ position: "absolute", inset: "58px 72px auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#211D17",
        }}
      >
        <div
          style={{
            fontSize: 31,
            fontWeight: 850,
            letterSpacing: "-0.04em",
          }}
        >
          HSK <span style={{ color: "#E04A40" }}>AI</span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#665D50",
              letterSpacing: "0.08em",
              marginLeft: 18,
            }}
          >
            ЗАБОНИ ЧИНӢ · ДАРСИ КӮТОҲ
          </span>
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 750,
            color: "#A89E8E",
            letterSpacing: "0.1em",
          }}
        >
          {String(index + 1).padStart(2, "0")} / 05
        </div>
      </div>
      <div style={{ display: "flex", gap: 9, marginTop: 24 }}>
        {lengths.map((length, i) => {
          const fill =
            i < index
              ? 1
              : i === index
                ? interpolate(frame, [0, duration], [0, 1], CLAMP)
                : 0;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 7,
                background: "rgba(33, 29, 23, 0.12)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: fill * 100 + "%",
                  height: "100%",
                  background: i === index ? "#E04A40" : "#2FA06A",
                  borderRadius: 10,
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 20,
          fontSize: 23,
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: "#E04A40",
        }}
      >
        {title}
      </div>
    </div>
  );
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Header index={0} title="МАВЗӮИ ИМРӮЗА" duration={90} frame={frame} />
      <div
        style={{
          position: "absolute",
          top: 365,
          left: 72,
          right: 72,
          textAlign: "center",
          ...show(frame, 1),
        }}
      >
        <div
          style={{
            color: "#211D17",
            fontSize: 85,
            fontWeight: 850,
            lineHeight: 1.1,
            letterSpacing: "-0.055em",
          }}
        >
          Дар забони чинӣ
          <br />
          <span style={{ color: "#E04A40" }}>«ту»</span> ва бо эҳтиром{" "}
          <span style={{ color: "#2FA06A" }}>«Шумо»</span>
        </div>
        <div
          style={{
            marginTop: 28,
            color: "#665D50",
            fontSize: 42,
            fontWeight: 600,
          }}
        >
          ду калимаи гуногун
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 950,
          left: 72,
          right: 72,
          display: "flex",
          gap: 24,
          justifyContent: "center",
        }}
      >
        {[
          { hanzi: "你", meaning: "ТУ", color: "#E04A40", delay: 12 },
          { hanzi: "您", meaning: "ШУМО", color: "#2FA06A", delay: 23 },
        ].map((item) => (
          <div
            key={item.hanzi}
            className="card"
            style={{
              width: 425,
              height: 450,
              textAlign: "center",
              padding: "36px 24px",
              borderTop: "9px solid " + item.color,
              ...show(frame, item.delay),
            }}
          >
            <div
              style={{
                fontSize: 212,
                lineHeight: 1.1,
                fontWeight: 650,
                color: item.color,
                fontFamily:
                  "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif",
              }}
            >
              {item.hanzi}
            </div>
            <div
              style={{
                marginTop: 30,
                fontSize: 35,
                fontWeight: 850,
                letterSpacing: "0.17em",
                color: "#211D17",
              }}
            >
              {item.meaning}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 1495,
          left: 100,
          right: 100,
          textAlign: "center",
          fontSize: 39,
          fontWeight: 700,
          color: "#665D50",
          ...show(frame, 35),
        }}
      >
        Фарқашонро якҷо мебинем <span style={{ color: "#E04A40" }}>↓</span>
      </div>
    </AbsoluteFill>
  );
};

const Vocabulary: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    { hanzi: "你", pinyin: "nǐ", meaning: "ту", note: "ғайрирасмӣ", color: "#E04A40" },
    { hanzi: "您", pinyin: "nín", meaning: "Шумо", note: "бо эҳтиром", color: "#2FA06A" },
    { hanzi: "你们", pinyin: "nǐmen", meaning: "шумо", note: "якчанд нафар", color: "#E9A916" },
  ];
  return (
    <AbsoluteFill>
      <Header index={1} title="СЕ ТАРЗИ МУРОҶИАТ" duration={150} frame={frame} />
      <div
        style={{
          position: "absolute",
          top: 305,
          left: 72,
          right: 72,
          fontSize: 70,
          fontWeight: 850,
          color: "#211D17",
          letterSpacing: "-0.05em",
          ...show(frame, 2),
        }}
      >
        Як фарқи хурд — маънои муҳим
      </div>
      {rows.map((row, i) => (
        <div
          key={row.hanzi}
          className="card"
          style={{
            position: "absolute",
            top: 470 + i * 302,
            left: 72,
            right: 72,
            height: 255,
            display: "flex",
            alignItems: "center",
            padding: "25px 36px",
            borderLeft: "10px solid " + row.color,
            ...show(frame, 8 + i * 9),
          }}
        >
          <div
            style={{
              width: 196,
              textAlign: "center",
              fontSize: row.hanzi.length > 1 ? 97 : 130,
              lineHeight: 1.1,
              fontWeight: 650,
              color: row.color,
              fontFamily:
                "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif",
            }}
          >
            {row.hanzi}
          </div>
          <div
            style={{
              width: 220,
              paddingLeft: 22,
              borderLeft: "1px solid rgba(33, 29, 23, 0.13)",
            }}
          >
            <div style={{ fontSize: 47, fontWeight: 700, color: "#665D50" }}>
              {row.pinyin}
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 27,
                fontWeight: 800,
                color: row.color,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {row.note}
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              minWidth: 300,
              fontSize: 58,
              fontWeight: 820,
              color: "#211D17",
            }}
          >
            {row.meaning}
          </div>
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          top: 1455,
          left: 72,
          right: 72,
          textAlign: "center",
          fontSize: 35,
          fontWeight: 650,
          color: "#665D50",
          ...show(frame, 35),
        }}
      >
        Ту · Шумо · Шумо (якчанд нафар)
      </div>
    </AbsoluteFill>
  );
};

type Greeting = {
  hanzi: string;
  pinyin: string;
  meaning: string;
  note: string;
  color: string;
};

const Example: React.FC<Greeting & { number: string }> = ({
  hanzi,
  pinyin,
  meaning,
  note,
  color,
  number,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Header index={2} title="MISOLLARDA KO‘RAMIZ" duration={300} frame={frame} />
      <div
        style={{
          position: "absolute",
          top: 385,
          left: 72,
          right: 72,
          display: "flex",
          justifyContent: "space-between",
          color: "#665D50",
          fontSize: 29,
          fontWeight: 800,
          letterSpacing: "0.1em",
          ...show(frame, 1),
        }}
      >
        <span>САЛОМГУФТАН</span>
        <span>{number} / 03</span>
      </div>
      <div
        className="card"
        style={{
          position: "absolute",
          top: 490,
          left: 72,
          right: 72,
          height: 860,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderTop: "12px solid " + color,
          ...show(frame, 4),
        }}
      >
        <div
          style={{
            fontSize: 210,
            lineHeight: 1.05,
            fontWeight: 650,
            color,
            fontFamily:
              "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif",
          }}
        >
          {hanzi}
        </div>
        <div
          style={{
            marginTop: 35,
            fontSize: 55,
            fontWeight: 700,
            color: "#665D50",
            letterSpacing: "0.02em",
          }}
        >
          {pinyin}
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 66,
            lineHeight: 1.15,
            fontWeight: 850,
            color: "#211D17",
            textAlign: "center",
          }}
        >
          {meaning}
        </div>
        <div
          style={{
            marginTop: 35,
            borderRadius: 100,
            padding: "15px 27px",
            background: color + "18",
            color,
            fontSize: 24,
            fontWeight: 850,
            letterSpacing: "0.09em",
          }}
        >
          {note}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 1440,
          left: 72,
          right: 72,
          display: "flex",
          justifyContent: "center",
          gap: 18,
        }}
      >
        {[0, 1, 2].map((dot) => (
          <div
            key={dot}
            style={{
              width: dot === Number(number) - 1 ? 44 : 13,
              height: 13,
              borderRadius: 20,
              background: dot === Number(number) - 1 ? color : "#EAE0CC",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Context: React.FC = () => {
  const frame = useCurrentFrame();
  const audiences = ["ОМӮЗГОР", "ШАХСИ КАЛОНСОЛ", "МУШТАРӢ"];
  return (
    <AbsoluteFill>
      <Header index={3} title="КАЙ 您 ИСТИФОДА МЕШАВАД?" duration={210} frame={frame} />
      <div
        style={{
          position: "absolute",
          top: 340,
          left: 72,
          right: 72,
          textAlign: "center",
          fontSize: 69,
          lineHeight: 1.13,
          fontWeight: 850,
          color: "#211D17",
          letterSpacing: "-0.045em",
          ...show(frame, 1),
        }}
      >
        Бо эҳтиром
        <br />
        муроҷиат кунед
      </div>
      <div
        style={{
          position: "absolute",
          top: 635,
          left: 72,
          right: 72,
          display: "flex",
          justifyContent: "center",
          gap: 14,
        }}
      >
        {audiences.map((person, i) => (
          <div
            key={person}
            className="pill"
            style={{
              padding: "16px 22px",
              fontSize: 29,
              fontWeight: 850,
              letterSpacing: "0.06em",
              ...show(frame, 8 + i * 8),
            }}
          >
            {person}
          </div>
        ))}
      </div>
      <div
        className="card"
        style={{
          position: "absolute",
          top: 805,
          left: 72,
          right: 72,
          height: 605,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: "11px solid #2FA06A",
          ...show(frame, 18),
        }}
      >
        <div
          style={{
            fontSize: 205,
            lineHeight: 1.05,
            fontWeight: 650,
            color: "#2FA06A",
            fontFamily:
              "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif",
          }}
        >
          您
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 57,
            fontWeight: 800,
            color: "#211D17",
          }}
        >
          «Шумо» — шакли боэҳтиром
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 1480,
          left: 92,
          right: 92,
          textAlign: "center",
          fontSize: 34,
          lineHeight: 1.3,
          fontWeight: 650,
          color: "#665D50",
          ...show(frame, 32),
        }}
      >
        Бо омӯзгор, калонсол ё муштарӣ суҳбат мекунед?
        <br />
        您 гуфтан табиитар аст.
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const verbs = ["ГУШ КУНЕД", "ДАР ҶУМЛА БИНЕД", "БО МАШҚ МУСТАҲКАМ КУНЕД"];
  return (
    <AbsoluteFill>
      <Header index={4} title="БО HSK AI ОМӮЗЕД" duration={150} frame={frame} />
      <div
        style={{
          position: "absolute",
          top: 335,
          left: 72,
          right: 72,
          textAlign: "center",
          ...show(frame, 2),
        }}
      >
        <div
          style={{
            fontSize: 94,
            fontWeight: 900,
            color: "#211D17",
            letterSpacing: "-0.07em",
          }}
        >
          HSK <span style={{ color: "#E04A40" }}>AI</span>
        </div>
        <div
          style={{
            marginTop: 25,
            fontSize: 48,
            lineHeight: 1.25,
            fontWeight: 700,
            color: "#665D50",
          }}
        >
          Калимаҳоро танҳо аз ёд накунед —
          <br />
          гӯш кунед, дар ҷумла бинед,
          <br />
          бо машқ мустаҳкам кунед.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 875,
          left: 72,
          right: 72,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 17,
        }}
      >
        {verbs.map((verb, i) => (
          <div
            key={verb}
            className="card"
            style={{
              width: 760,
              padding: "22px 32px",
              textAlign: "center",
              color: ["#E04A40", "#2FA06A", "#E9A916"][i],
              fontSize: 31,
              fontWeight: 850,
              letterSpacing: "0.12em",
              ...show(frame, 13 + i * 8),
            }}
          >
            <span style={{ marginRight: 17 }}>{["◉", "◌", "✓"][i]}</span>
            {verb}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 1410,
          left: 72,
          right: 72,
          textAlign: "center",
          ...show(frame, 32),
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "26px 55px",
            borderRadius: 100,
            color: "#FFFFFF",
            background: "#E04A40",
            fontSize: 39,
            fontWeight: 900,
            letterSpacing: "0.1em",
            boxShadow: "0 16px 0 rgba(190, 58, 41, 0.18)",
          }}
        >
          ИН ВИДЕОРО ЗАХИРА КУНЕД
        </div>
        <div
          style={{
            marginTop: 42,
            fontSize: 38,
            fontWeight: 700,
            color: "#211D17",
          }}
        >
          Фарқи 你 ва 您-ро фаромӯш накунед!
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LessonVideo: React.FC = () => {
  const greetings: Greeting[] = [
    { hanzi: "你好！", pinyin: "Nǐ hǎo!", meaning: "Салом!", note: "ТУ · ҒАЙРИРАСМӢ", color: "#E04A40" },
    { hanzi: "您好！", pinyin: "Nín hǎo!", meaning: "Салом!", note: "ШУМО · БО ЭҲТИРОМ", color: "#2FA06A" },
    { hanzi: "你们好！", pinyin: "Nǐmen hǎo!", meaning: "Салом ба шумо!", note: "ШУМО · ЯКЧАНД НАФАР", color: "#E9A916" },
  ];
  return (
    <AbsoluteFill className="frame">
      <Background />
      <Sequence durationInFrames={90}>
        <Intro />
      </Sequence>
      <Sequence from={90} durationInFrames={150}>
        <Vocabulary />
      </Sequence>
      <Sequence from={240} durationInFrames={100}>
        <Example {...greetings[0]} number="1" />
      </Sequence>
      <Sequence from={340} durationInFrames={100}>
        <Example {...greetings[1]} number="2" />
      </Sequence>
      <Sequence from={440} durationInFrames={100}>
        <Example {...greetings[2]} number="3" />
      </Sequence>
      <Sequence from={540} durationInFrames={210}>
        <Context />
      </Sequence>
      <Sequence from={750} durationInFrames={150}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};

export const MyComposition: React.FC = () => (
  <Composition
    id="TuVaSiz-Tojikcha"
    component={LessonVideo}
    durationInFrames={DURATION}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
