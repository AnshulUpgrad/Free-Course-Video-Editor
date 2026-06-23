import "./index.css";
import { Composition } from "remotion";

// Import Components & Default Data
import { ChapterDivider, defaultChapterDividerData } from "./templates/ChapterDivider";
import { ConceptCard, defaultConceptData } from "./templates/ConceptCard";
import { KeywordCard, defaultKeywordData } from "./templates/KeywordCard";
import { DefinitionCard, defaultDefinitionData } from "./templates/DefinitionCard";
import { BulletList, defaultBulletListData } from "./templates/BulletList";
import { StepSequence, defaultStepSequenceData } from "./templates/StepSequence";
import { ProcessFlow, defaultProcessFlowData } from "./templates/ProcessFlow";
import { ComparisonCard, defaultComparisonData } from "./templates/ComparisonCard";
import { VisualExplanation, defaultVisualData } from "./templates/VisualExplanation";
import { Takeaways, defaultTakeawaysData } from "./templates/Takeaways";
import { Postcard, defaultPostcardBulletsData, defaultPostcardParagraphData } from "./templates/Postcard";

// Import Showcase
import { Showcase, ShowcaseProps } from "./Showcase";

const defaultShowcaseProps: ShowcaseProps = {
  audioUrl: "",
  timeline: [
    {
      templateId: "ChapterDivider",
      durationInFrames: 75,
      startTime: 0,
      endTime: 2.5,
      data: defaultChapterDividerData
    },
    {
      templateId: "ConceptCard",
      durationInFrames: 75,
      startTime: 2.5,
      endTime: 5.0,
      data: defaultConceptData
    },
    {
      templateId: "KeywordCard",
      durationInFrames: 60,
      startTime: 5.0,
      endTime: 7.0,
      data: defaultKeywordData
    },
    {
      templateId: "DefinitionCard",
      durationInFrames: 105,
      startTime: 7.0,
      endTime: 10.5,
      data: defaultDefinitionData
    },
    {
      templateId: "BulletList",
      durationInFrames: 105,
      startTime: 10.5,
      endTime: 14.0,
      data: defaultBulletListData
    },
    {
      templateId: "StepSequence",
      durationInFrames: 150,
      startTime: 14.0,
      endTime: 19.0,
      data: defaultStepSequenceData
    },
    {
      templateId: "ProcessFlow",
      durationInFrames: 135,
      startTime: 19.0,
      endTime: 23.5,
      data: defaultProcessFlowData
    },
    {
      templateId: "ComparisonCard",
      durationInFrames: 135,
      startTime: 23.5,
      endTime: 28.0,
      data: defaultComparisonData
    },
    {
      templateId: "VisualExplanation",
      durationInFrames: 120,
      startTime: 28.0,
      endTime: 32.0,
      data: defaultVisualData
    },
    {
      templateId: "PostcardBullets",
      durationInFrames: 135,
      startTime: 32.0,
      endTime: 36.5,
      data: defaultPostcardBulletsData
    },
    {
      templateId: "PostcardParagraph",
      durationInFrames: 120,
      startTime: 36.5,
      endTime: 40.5,
      data: defaultPostcardParagraphData
    },
    {
      templateId: "Takeaways",
      durationInFrames: 120,
      startTime: 40.5,
      endTime: 44.5,
      data: defaultTakeawaysData
    }
  ]
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 12 Individual Template Compositions (1920x1080, 30fps) */}
      <Composition
        id="ChapterDivider"
        component={ChapterDivider}
        durationInFrames={75}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultChapterDividerData }}
      />
      <Composition
        id="ConceptCard"
        component={ConceptCard}
        durationInFrames={75}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultConceptData }}
      />
      <Composition
        id="KeywordCard"
        component={KeywordCard}
        durationInFrames={60}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultKeywordData }}
      />
      <Composition
        id="DefinitionCard"
        component={DefinitionCard}
        durationInFrames={105}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultDefinitionData }}
      />
      <Composition
        id="BulletList"
        component={BulletList}
        durationInFrames={105}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultBulletListData }}
      />
      <Composition
        id="StepSequence"
        component={StepSequence}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultStepSequenceData }}
      />
      <Composition
        id="ProcessFlow"
        component={ProcessFlow}
        durationInFrames={135}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultProcessFlowData }}
      />
      <Composition
        id="ComparisonCard"
        component={ComparisonCard}
        durationInFrames={135}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultComparisonData }}
      />
      <Composition
        id="VisualExplanation"
        component={VisualExplanation}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultVisualData }}
      />
      <Composition
        id="Takeaways"
        component={Takeaways}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultTakeawaysData }}
      />
      <Composition
        id="PostcardBullets"
        component={Postcard}
        durationInFrames={135}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultPostcardBulletsData }}
      />
      <Composition
        id="PostcardParagraph"
        component={Postcard}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultPostcardParagraphData }}
      />

      {/* Dynamic Showcase Video using input props timeline */}
      <Composition
        id="Showcase"
        component={Showcase}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultShowcaseProps}
        calculateMetadata={({ props }) => {
          const timeline = (props as ShowcaseProps).timeline || defaultShowcaseProps.timeline;
          const totalFrames = timeline.reduce((acc, slide) => acc + (slide.durationInFrames || 0), 0);
          return {
            durationInFrames: totalFrames || 1335,
            props: props,
          };
        }}
      />
    </>
  );
};
