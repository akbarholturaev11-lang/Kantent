import { AbsoluteFill, Composition, Img, registerRoot, staticFile } from "remotion";
import characters from "../content/characters/hsk-ai-characters.json";
import { LiquidGlass } from "./IllustratedLessonScene";

type CoverProps = {
  title: string;
  terms: string[];
  images: string[];
  background: string | null;
  frameData?: string;
  pandaMood: string | null;
};

const palette = [
  { ink: "#f3ffda", tint: "rgba(42,60,32,.76)", rim: "#cce5aa" },
  { ink: "#ffe5bf", tint: "rgba(72,42,22,.78)", rim: "#ffd094" },
];
const Cover = ({ title, terms, images, background, frameData, pandaMood }: CoverProps) => {
  const panda = characters.characters.find(item => item.id === "panda");
  const svg = pandaMood && (panda?.svg as Record<string, string> | undefined)?.[pandaMood];
  const titleSize = title.length <= 18 ? 92 : title.length <= 30 ? 72 : 58;
  const split = images.length === 2;
  return <AbsoluteFill style={{ background: "#201510", color: "#fff4e4", fontFamily: "Arial, 'Noto Sans', sans-serif", overflow: "hidden" }}>
    {(background || frameData) && <Img src={background ? staticFile(background) : frameData!}
      style={{ position: "absolute", inset: -20, width: 1120, height: 1960, objectFit: "cover",
        filter: `blur(${split || frameData ? 14 : 3}px) brightness(${split ? .49 : .65})` }} />}
    <AbsoluteFill style={{ background: "linear-gradient(180deg,#170d09b5 4%,#20100845 51%,#170d09c9 95%)" }} />
    <div style={{ position: "absolute", top: 420, left: 84, right: 84, height: 220,
      display: "grid", placeItems: "center", textAlign: "center", fontSize: titleSize,
      fontWeight: 900, lineHeight: 1.05, textWrap: "balance", overflowWrap: "anywhere",
      textShadow: "0 6px 24px #1b0b04" }}>{title}</div>
    {frameData && !background && <Img src={frameData} style={{ position: "absolute", left: 200, top: 690,
      width: 680, height: 660, borderRadius: 42, objectFit: "cover", objectPosition: "center 58%",
      boxShadow: "0 28px 70px #140b07b5" }} />}
    {images.map((src, index) => <Img key={src} src={staticFile(src)} style={{ position: "absolute",
      left: index ? 651 : 53, top: 828, width: 376, height: 465, objectFit: "cover",
      objectPosition: "50% 66%", borderRadius: 38, border: `4px solid ${palette[index].rim}`,
      transform: `rotate(${index ? 8 : -8}deg)`, boxShadow: "0 25px 54px #140b07b5" }} />)}
    {svg && <Img src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)} style={{
      position: "absolute", left: 338, top: split ? 849 : 853, width: 404, height: 466,
      transform: `rotate(${split ? 5 : -4}deg)`, filter: "drop-shadow(0 22px 28px #190e09b0)" }} />}
    {terms.map((term, index) => <div key={term} style={{ position: "absolute", top: 674,
      left: terms.length === 1 ? 540 : index ? 835 : 245, transform: "translateX(-50%)" }}>
      <LiquidGlass radius={45} tint={palette[index].tint} style={{
        minWidth: 208, padding: "3px 23px 10px", textAlign: "center", borderColor: palette[index].rim,
        fontFamily: "'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
        fontSize: term.length > 4 ? 62 : 80, fontWeight: 750, whiteSpace: "nowrap", color: palette[index].ink,
      }}>{term}</LiquidGlass>
    </div>)}
  </AbsoluteFill>;
};

registerRoot(() => <Composition id="HSKAI-Cover" component={Cover} width={1080} height={1920} fps={30}
  durationInFrames={1} defaultProps={{ title: "", terms: [], images: [], background: null, pandaMood: null } as CoverProps} />);
