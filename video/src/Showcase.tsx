import React from 'react';
import { Series, Audio, Video, staticFile, AbsoluteFill } from 'remotion';
import { ChapterDivider } from './templates/ChapterDivider';
import { ConceptCard } from './templates/ConceptCard';
import { KeywordCard } from './templates/KeywordCard';
import { DefinitionCard } from './templates/DefinitionCard';
import { BulletList } from './templates/BulletList';
import { StepSequence } from './templates/StepSequence';
import { ComparisonCard } from './templates/ComparisonCard';
import { VisualExplanation } from './templates/VisualExplanation';
import { Takeaways } from './templates/Takeaways';
import { Postcard } from './templates/Postcard';

export type RenderMode = 'fullscreen' | 'overlay' | 'picture-in-picture';

export interface TimelineSlide {
  templateId: string;
  durationInFrames: number;
  startTime: number;
  endTime: number;
  data: any;
}

export interface ShowcaseProps {
  audioUrl?: string;
  videoUrl?: string;
  renderMode?: RenderMode;
  timeline?: TimelineSlide[];
}

export const Showcase: React.FC<ShowcaseProps> = ({ audioUrl, videoUrl, renderMode, timeline = [] }) => {
  const activeRenderMode = videoUrl ? 'overlay' : 'fullscreen';

  const renderTemplateOnly = (templateId: string, data: any) => {
    switch (templateId) {
      case 'ChapterDivider':
        return <ChapterDivider data={data} />;
      case 'ConceptCard':
        return <ConceptCard data={data} />;
      case 'KeywordCard':
        return <KeywordCard data={data} />;
      case 'DefinitionCard':
        return <DefinitionCard data={data} />;
      case 'BulletList':
        return <BulletList data={data} />;
      case 'StepSequence':
        return <StepSequence data={data} />;
      case 'ComparisonCard':
        return <ComparisonCard data={data} />;
      case 'VisualExplanation':
        return <VisualExplanation data={data} />;
      case 'PostcardBullets':
      case 'PostcardParagraph': {
        const resolvedData = { ...data };
        if (resolvedData.image && typeof resolvedData.image === 'string' && !resolvedData.image.startsWith('http') && !resolvedData.image.startsWith('data:')) {
          resolvedData.image = staticFile(resolvedData.image);
        }
        return <Postcard data={resolvedData} />;
      }
      case 'Takeaways':
        return <Takeaways data={data} />;
      case 'FaceOnly':
        return null;
      default:
        return <ConceptCard data={{ concept: `Template: ${templateId}`, renderMode: activeRenderMode }} />;
    }
  };

  const renderSlide = (slide: TimelineSlide) => {
    const dataWithMode = { renderMode: activeRenderMode, ...slide.data };

    const shouldDisappear = ['ChapterDivider', 'ConceptCard', 'KeywordCard'].includes(slide.templateId);

    if (shouldDisappear) {
      const templateDuration = Math.min(slide.durationInFrames, 150); // 5 seconds (150 frames) max
      const emptyDuration = slide.durationInFrames - templateDuration;

      return (
        <Series>
          <Series.Sequence durationInFrames={templateDuration}>
            {renderTemplateOnly(slide.templateId, dataWithMode)}
          </Series.Sequence>
          {emptyDuration > 0 && (
            <Series.Sequence durationInFrames={emptyDuration}>
              <div />
            </Series.Sequence>
          )}
        </Series>
      );
    }

    return renderTemplateOnly(slide.templateId, dataWithMode);
  };

  const resolvedVideoUrl = videoUrl ? staticFile(videoUrl) : null;
  const resolvedAudioUrl = audioUrl ? staticFile(audioUrl) : null;

  return (
    <>
      {resolvedVideoUrl ? (
        <AbsoluteFill style={{ backgroundColor: '#111827' }}>
          <Video
            src={resolvedVideoUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      ) : (
        resolvedAudioUrl && <Audio src={resolvedAudioUrl} />
      )}
      <Series>
        {timeline.map((slide, index) => (
          <Series.Sequence
            key={`${slide.templateId}-${index}`}
            durationInFrames={slide.durationInFrames}
          >
            {renderSlide(slide)}
          </Series.Sequence>
        ))}
      </Series>
    </>
  );
};

