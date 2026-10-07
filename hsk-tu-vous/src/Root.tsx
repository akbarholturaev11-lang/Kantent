import "./index.css";
import { MyComposition } from "./Composition";
import { EpisodeComposition } from "./EpisodeComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <EpisodeComposition />
    </>
  );
};
