import "./index.css";
import { MyComposition } from "./Composition";
import { EpisodeComposition } from "./EpisodeComposition";
import { HuiNengVisualReview } from "./HuiNengVisualReview";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <EpisodeComposition />
      <HuiNengVisualReview />
    </>
  );
};
