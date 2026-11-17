import {AbsoluteFill, Composition, Sequence, useCurrentFrame} from "remotion";
import type {ResolvedMotionBeat} from "../../scripts/motion-design-plan.mjs";
import {planVisualModes} from "../../scripts/pro-motion-plan.mjs";
import {ICON_KINDS, MeaningIcon} from "./MeaningIcons";
import {SlideBackground, SlideContent} from "./MotionSlide";

/**
 * Review sheet of the meaning-visual library (not a lesson): one formula
 * slide per sentence pattern, then every icon. Render it after changing
 * MeaningStages/MeaningIcons or content/meaning-visuals.json:
 *   npx remotion render src/index.ts HSKAI-MeaningGallery review/meaning-gallery.mp4 --scale 0.5
 */
const SAMPLES:[string,string,string][]=[
  ["他比我高。","Tā bǐ wǒ gāo.","Он выше меня."],
  ["今天比昨天冷。","Jīntiān bǐ zuótiān lěng.","Сегодня холоднее, чем вчера."],
  ["桌子上有一本书。","Zhuōzi shang yǒu yì běn shū.","На столе есть книга."],
  ["那本书在桌子上。","Nà běn shū zài zhuōzi shang.","Та книга на столе."],
  ["你喝茶还是喝咖啡？","Nǐ hē chá háishi hē kāfēi?","Чай или кофе?"],
  ["茶或者咖啡都行。","Chá huòzhě kāfēi dōu xíng.","Чай или кофе — всё равно."],
  ["我会游泳。","Wǒ huì yóuyǒng.","Я умею плавать."],
  ["我今天不能游泳。","Wǒ jīntiān bù néng yóuyǒng.","Сегодня я не могу плавать."],
  ["我也是学生。","Wǒ yě shì xuésheng.","Я тоже студент."],
  ["我们都是学生。","Wǒmen dōu shì xuésheng.","Мы все студенты."],
  ["这个有点儿贵。","Zhège yǒudiǎnr guì.","Это немного дорого."],
  ["便宜一点儿。","Piányi yìdiǎnr.","Подешевле."],
  ["你有几本书？","Nǐ yǒu jǐ běn shū?","Сколько у тебя книг?"],
  ["这个多少钱？","Zhège duōshao qián?","Сколько это стоит?"],
  ["我想喝水。","Wǒ xiǎng hē shuǐ.","Я хочу пить."],
  ["你叫什么名字？","Nǐ jiào shénme míngzi?","Как тебя зовут?"],
  ["我没有他高。","Wǒ méiyǒu tā gāo.","Я не такой высокий, как он."],
  ["我跟他一样高。","Wǒ gēn tā yíyàng gāo.","Я такого же роста, как он."],
  ["今天没有昨天冷。","Jīntiān méiyǒu zuótiān lěng.","Сегодня не так холодно, как вчера."],
  ["桌子上","Zhuōzi shang","На столе"],
  ["茶 / 咖啡","chá / kāfēi","чай / кофе"],
  ["我明天去学校。","Wǒ míngtiān qù xuéxiào.","Завтра я иду в школу."],
  ["我不喝咖啡。","Wǒ bù hē kāfēi.","Я не пью кофе."],
  ["我吃了饭。","Wǒ chī le fàn.","Я поел."],
  ["我和朋友一起看电影。","Wǒ hé péngyou yìqǐ kàn diànyǐng.","Я смотрю фильм с другом."],
  ["这件衣服多少钱？","Zhè jiàn yīfu duōshao qián?","Сколько стоит эта одежда?"],
  ["一杯咖啡十五块。","Yì bēi kāfēi shíwǔ kuài.","Чашка кофе — пятнадцать юаней."],
  ["你几点睡觉？","Nǐ jǐ diǎn shuìjiào?","Во сколько ты ложишься спать?"],
];
const PER=90, ICON_FRAMES=150;
const beatOf=([hanzi,pinyin,meaning]:[string,string,string],i:number)=>({id:"s"+i,localFrame:0,
  visual:{hanzi,pinyin,meaning,illustration:{layout:"board",images:[]}}}) as unknown as ResolvedMotionBeat;

const Sample:React.FC<{index:number}>=({index})=>{
  const frame=useCurrentFrame()+4;
  const beats=[beatOf(SAMPLES[index],index)];
  const modes=planVisualModes(beats,{hanzi:"比",pinyin:"bǐ"});
  return <AbsoluteFill style={{background:"#08090B"}}>
    <SlideBackground theme={["ink","sky","teal","ember"][index%4]} frame={frame} episodeId="gallery"/>
    <SlideContent episodeId="gallery" beats={beats} modes={modes} index={0} frame={frame} focus={{hanzi:"比",pinyin:"bǐ"}}/>
  </AbsoluteFill>;
};

const Icons:React.FC=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:"#101216",display:"flex",flexWrap:"wrap",alignContent:"flex-start",gap:14,padding:"110px 34px",color:"#FFF",fontSize:17}}>
    {ICON_KINDS.map((kind,i)=><div key={kind} style={{width:104,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
      <MeaningIcon kind={kind} age={frame-i} size={80}/><span>{kind}</span></div>)}
  </AbsoluteFill>;
};

const MeaningGallery:React.FC=()=><AbsoluteFill>
  {SAMPLES.map((_,i)=><Sequence key={i} from={i*PER} durationInFrames={PER}><Sample index={i}/></Sequence>)}
  <Sequence from={SAMPLES.length*PER} durationInFrames={ICON_FRAMES}><Icons/></Sequence>
</AbsoluteFill>;

export const MeaningGalleryComposition:React.FC=()=><Composition id="HSKAI-MeaningGallery" component={MeaningGallery}
  durationInFrames={SAMPLES.length*PER+ICON_FRAMES} fps={30} width={1080} height={1920}/>;
