import "./index.css";
import { MyComposition } from "./Composition";
import { EpisodeComposition } from "./EpisodeComposition";
import { MeaningGalleryComposition } from "./pro-motion/MeaningGallery";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <EpisodeComposition />
      <MeaningGalleryComposition />
    </>
  );
};
