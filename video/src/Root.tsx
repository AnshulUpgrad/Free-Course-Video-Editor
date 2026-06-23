import "./index.css";
import { Composition, getInputProps } from "remotion";

// Import Components & Default Data
import { ChapterDivider, defaultChapterDividerData } from "./templates/ChapterDivider";
import { ConceptCard, defaultConceptData } from "./templates/ConceptCard";
import { KeywordCard, defaultKeywordData } from "./templates/KeywordCard";
import { DefinitionCard, defaultDefinitionData, defaultShortDefinitionData } from "./templates/DefinitionCard";
import { BulletList, defaultBulletListData, defaultHalfScreenBulletListData } from "./templates/BulletList";
import { StepSequence, defaultStepSequenceData, defaultHalfScreenStepSequenceData } from "./templates/StepSequence";
import { ComparisonCard, defaultComparisonData } from "./templates/ComparisonCard";
import { VisualExplanation, defaultVisualData } from "./templates/VisualExplanation";
import { Takeaways, defaultTakeawaysData, defaultHalfScreenTakeawaysData } from "./templates/Takeaways";
import { Postcard, defaultPostcardBulletsData, defaultPostcardParagraphData } from "./templates/Postcard";

// Import Showcase
import { Showcase, ShowcaseProps } from "./Showcase";
import timelineJson from "./timeline.json";

const fps = 30;

export const loadTimelineData = (props: any): ShowcaseProps => {
  const videoUrl = props.videoUrl !== undefined ? props.videoUrl : (timelineJson.videoUrl ?? "uploads/Sample.MP4");
  const audioUrl = props.audioUrl !== undefined ? props.audioUrl : (timelineJson.audioUrl ?? "");
  const rawTimeline = props.timeline ?? timelineJson.timeline ?? [];

  const timeline = rawTimeline.map((slide: any) => {
    const startTime = slide.startTime ?? slide.start_time ?? 0;
    const stopTime = slide.stopTime ?? slide.stop_time ?? slide.endTime ?? slide.end_time ?? startTime + 2;
    const durationInFrames = Math.round((stopTime - startTime) * fps);

    const { templateId, data, ...rest } = slide;
    const mergedData = { ...rest, ...data };

    // Clean up timing attributes from internal data
    delete mergedData.startTime;
    delete mergedData.stopTime;
    delete mergedData.start_time;
    delete mergedData.stop_time;
    delete mergedData.endTime;
    delete mergedData.end_time;
    delete mergedData.durationInFrames;

    return {
      templateId,
      startTime,
      endTime: stopTime,
      durationInFrames,
      data: mergedData,
    };
  });

  return {
    videoUrl,
    audioUrl,
    timeline,
  };
};

const defaultShowcaseProps = loadTimelineData(getInputProps());

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
        id="ShortDefinitionCard"
        component={DefinitionCard}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultShortDefinitionData }}
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
        id="HalfScreenBulletList"
        component={BulletList}
        durationInFrames={105}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultHalfScreenBulletListData }}
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
        id="HalfScreenStepSequence"
        component={StepSequence}
        durationInFrames={135}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultHalfScreenStepSequenceData }}
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
        durationInFrames={350}
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
        id="HalfScreenTakeaways"
        component={Takeaways}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ data: defaultHalfScreenTakeawaysData }}
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
          const resolved = loadTimelineData(props);
          const totalFrames = resolved.timeline ? resolved.timeline.reduce((acc, slide) => acc + (slide.durationInFrames || 0), 0) : 1335;
          return {
            durationInFrames: totalFrames || 1335,
            props: resolved as any,
          };
        }}
      />
    </>
  );
};
