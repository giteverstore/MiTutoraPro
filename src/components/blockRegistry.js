import { AIExplanationBlock } from './blocks/AIExplanationBlock';
import { CalloutBlock } from './blocks/CalloutBlock';
import { CodeBlock } from './blocks/CodeBlock';
import { CompilerBlock } from './blocks/CompilerBlock';
import { DividerBlock } from './blocks/DividerBlock';
import { ExerciseBlock } from './blocks/ExerciseBlock';
import { HeadingBlock } from './blocks/HeadingBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { NoteBlock } from './blocks/NoteBlock';
import { ParagraphBlock } from './blocks/ParagraphBlock';
import { QuizBlock } from './blocks/QuizBlock';
import { TableBlock } from './blocks/TableBlock';
import { UnknownBlock } from './blocks/UnknownBlock';
import { VideoBlock } from './blocks/VideoBlock';
import { WarningBlock } from './blocks/WarningBlock';
import { SolutionBlock } from './blocks/SolutionBlock';

const blockRegistry = Object.freeze({
  heading: HeadingBlock,
  paragraph: ParagraphBlock,
  code: CodeBlock,
  image: ImageBlock,
  quiz: QuizBlock,
  exercise: ExerciseBlock,
  compiler: CompilerBlock,
  ai_explanation: AIExplanationBlock,
  note: NoteBlock,
  warning: WarningBlock,
  divider: DividerBlock,
  callout: CalloutBlock,
  video: VideoBlock,
  table: TableBlock,
  solution: SolutionBlock,
});

export function resolveBlockComponent(type) {
  return blockRegistry[type] ?? UnknownBlock;
}
