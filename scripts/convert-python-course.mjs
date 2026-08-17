import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { load } from 'cheerio';
import mammoth from 'mammoth';

const SOURCE_PATH = resolve('Python Module 1.docx');
const FIREBASE_OUTPUT_ROOT = resolve('firebase-content/course-content/python');
const FIREBASE_METADATA_ROOT = resolve('firebase-content/firestore/courses');
const ASSET_DIRECTORY = resolve('public/assets/courses/python-foundations');
const PUBLIC_COURSE_PATH = resolve('public/courses/python-course.json');
const LOCAL_METADATA_PATH = resolve('public/courses/course-metadata.json');
const SCHEMA_PATH = resolve('schemas/learning-course.schema.json');

const moduleTitles = {
  1: 'Getting Started with Python',
  2: 'Python Data Types',
  3: 'Python Comments',
  4: 'Python Variables',
  5: 'Python Output and f-strings',
  6: 'Python Operators',
  7: 'Data Conversion',
  8: 'User Input',
  9: 'Introduction Examples and Review',
};

const chapterGroupTitles = {
  1: '1.1 Get Started',
  2: '1.2 Numbers and Strings',
  3: '1.3 Comments',
  4: '1.4 Variables',
  5: '1.5 Output',
  6: '1.6 Arithmetic Operators',
  7: '1.7 Data Conversion',
  8: '1.8 Get User Input',
  9: '1.9 Introduction Examples',
  10: '1.10 Recall',
};

const quizAnswers = {
  '1.4': 'C',
  '2.6': 'C',
  '2.9': 'C',
  '3.4': 'B',
  '3.5': 'D',
  '4.3': 'A',
  '4.7': 'B',
  '4.8': 'D',
  '4.13': 'A',
  '4.17': 'B',
  '4.18': 'D',
  '5.4': 'A',
  '5.7': 'C',
  '5.11': 'C',
  '6.5': 'C',
  '6.9': 'C',
  '6.11': 'B',
  '6.15': 'B',
  '7.9': 'A',
  '8.8': 'B',
};

// Runnable examples are an explicit content-authoring decision. Every other code block is display-only.
const runnableExamples = new Map([
  ['page-1-2-code-3'],
  ['page-2-1-code-2'], ['page-2-2-code-6'], ['page-2-7-code-3'], ['page-2-7-code-6'],
  ['page-2-8-code-2'], ['page-2-8-code-9'], ['page-2-8-code-11'], ['page-2-11-code-3'],
  ['page-3-1-code-3'], ['page-3-2-code-7'], ['page-3-3-code-2'], ['page-3-3-code-7'],
  ['page-4-4-code-2'], ['page-4-5-code-2'], ['page-4-10-code-2'], ['page-4-14-code-2'],
  ['page-4-21-code-3'], ['page-4-21-code-6'], ['page-4-21-code-9'], ['page-4-21-code-12'],
  ['page-5-1-code-2'], ['page-5-2-code-2'], ['page-5-3-code-2'], ['page-5-6-code-3'],
  ['page-5-6-code-6'], ['page-5-9-code-5'], ['page-5-10-code-3'], ['page-5-10-code-8'],
  ['page-5-13-code-12'], ['page-5-14-code-10'],
  ['page-6-1-code-4'], ['page-6-3-code-2'], ['page-6-4-code-3'], ['page-6-6-code-2'],
  ['page-6-8-code-2'], ['page-6-8-code-4'], ['page-6-10-code-2'], ['page-6-10-code-4'],
  ['page-6-12-code-5'], ['page-6-12-code-8'], ['page-6-14-code-5'], ['page-6-14-code-7'],
  ['page-6-17-code-2'], ['page-6-17-code-5'], ['page-6-19-code-2'], ['page-6-19-code-5'],
  ['page-7-2-code-3'], ['page-7-2-code-6'], ['page-7-4-code-3'], ['page-7-4-code-6'],
  ['page-7-7-code-2'], ['page-7-8-code-3'],
  ['page-8-2-code-2', 'Sara'], ['page-8-3-code-2', 'Ali khan'],
  ['page-8-6-code-2', '5\n10'], ['page-8-7-code-2', '5\n10'],
  ['page-9-4-code-5'], ['page-9-6-code-6'], ['page-9-7-code-2'],
  ['page-9-10-code-2'], ['page-9-11-code-2'],
].map(([id, stdin = '']) => [id, { stdin }]));

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'content';
}

function normalizedText($, element) {
  const copy = $(element).clone();
  copy.find('br').replaceWith('\n');
  return copy.text().replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function paragraphText($, element) {
  const copy = $(element).clone();
  copy.find('br').replaceWith('\n');
  let hasLinks = false;
  copy.find('a[href]').each((_, anchor) => {
    hasLinks = true;
    const link = $(anchor);
    link.replaceWith(`[${link.text()}](${link.attr('href')})`);
  });
  return {
    content: copy.text().replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim(),
    format: hasLinks ? 'markdown' : 'plain',
  };
}

function tableLines($, table) {
  return $(table)
    .find('p')
    .map((_, paragraph) => normalizedText($, paragraph))
    .get()
    .flatMap((line) => line.split('\n').map((part) => part.trim()))
    .filter(Boolean)
    .filter((line) => !/^Run\s*Code\s*>>$/i.test(line));
}

function tableGrid($, table) {
  return $(table).find('tr').toArray()
    .map((row) => $(row).find('td, th').toArray().map((cell) => {
      const value = normalizedText($, cell);
      return /^Run\s*Code\s*>>$/i.test(value) ? '' : value;
    }))
    .filter((row) => row.some(Boolean));
}

function createBlockFactory(pageNumber) {
  let sequence = 0;
  return (type, data) => {
    const createdBlock = {
      id: `${slugify(`page-${pageNumber}`)}-${slugify(type)}-${++sequence}`,
      type,
      ...data,
    };
    if (type === 'code') createdBlock.mode = 'display';
    return createdBlock;
  };
}

function createQuizLesson($, pageNumber, title, nodes, block) {
  const blocks = [];
  const optionRecords = [];
  const supportingParagraphs = [];

  for (const node of nodes) {
    const text = normalizedText($, node);
    if (!text) continue;

    if ($(node).is('table')) {
      const lines = tableLines($, node);
      const optionLine = lines[0]?.match(/^([A-D])\s*:\s*(.+)$/i);

      if (optionLine) {
        optionRecords.push({
          letter: optionLine[1].toUpperCase(),
          text: [optionLine[2], ...lines.slice(1)].join('\n'),
        });
      } else {
        blocks.push(block('code', {
          language: 'python',
          code: lines.join('\n'),
          caption: 'Quiz code',
        }));
      }
      continue;
    }

    const paragraphOption = text.match(/^([A-D])\s*:\s*(.+)$/i);
    if (paragraphOption) {
      optionRecords.push({
        letter: paragraphOption[1].toUpperCase(),
        text: paragraphOption[2],
      });
    } else if (!/^Tap an option below to answer:?$/i.test(text)) {
      supportingParagraphs.push(text);
    }
  }

  supportingParagraphs.forEach((content) => {
    blocks.push(block(
      /^Note:/i.test(content) ? 'note' : 'paragraph',
      /^Note:/i.test(content)
        ? { title: 'Note', content: content.replace(/^Note:\s*/i, ''), format: 'plain' }
        : { content, format: 'plain' },
    ));
  });

  const options = optionRecords.map(({ letter, text }) => ({
    id: `option-${letter.toLowerCase()}`,
    text,
  }));
  const answer = quizAnswers[pageNumber];

  blocks.push(block('quiz', {
    question: title.replace(/^Quiz:\s*/i, ''),
    selectionMode: 'single',
    options,
    correctOptionIds: [`option-${answer.toLowerCase()}`],
    submitLabel: 'Check answer',
  }));

  return blocks;
}

function createExerciseLesson($, pageNumber, title, nodes, block) {
  const blocks = [];
  const instructions = [];
  const objectives = [];
  const hints = [];
  let exerciseTitle = title;
  let listTarget = objectives;
  let afterSolution = false;
  let aiMode = false;
  let collectingExpectedOutput = false;
  const expectedOutputLines = [];
  const inputLines = [];
  let solutionCode = '';
  let solutionExplanation = '';
  let pendingCaption = '';

  for (const node of nodes) {
    const text = normalizedText($, node);
    if (!text) continue;

    if ($(node).is('ul, ol')) {
      $(node).find('li').each((_, item) => listTarget.push(normalizedText($, item)));
      continue;
    }

    if ($(node).is('table')) {
      const lines = tableLines($, node);
      const firstLine = lines[0] ?? '';
      const isExpectedOutput = /^Expected Output$/i.test(firstLine);
      const isTestInput = /^Test Input$/i.test(firstLine);

      if (isExpectedOutput) {
        blocks.push(block('code', {
          language: 'text',
          code: lines.slice(1).join('\n'),
          caption: 'Expected Output',
        }));
        collectingExpectedOutput = false;
      } else if (isTestInput) {
        inputLines.push(...lines.slice(1));
      } else if (aiMode) {
        solutionExplanation = lines.join('\n\n');
        aiMode = false;
      } else if (afterSolution) {
        solutionCode = lines.join('\n');
      } else {
        blocks.push(block('code', {
          language: 'python',
          code: lines.join('\n'),
          caption: pendingCaption || (afterSolution ? 'Solution' : 'Example'),
        }));
      }
      pendingCaption = '';
      continue;
    }

    if (/^Hints?:$/i.test(text)) {
      listTarget = hints;
    } else if (/^Example$/i.test(text)) {
      pendingCaption = 'Example';
    } else if (/^Expected Output$/i.test(text)) {
      collectingExpectedOutput = true;
    } else if (/^SOLUTION/i.test(text)) {
      if (expectedOutputLines.length) {
        blocks.push(block('code', {
          language: 'text',
          code: expectedOutputLines.join('\n'),
          caption: 'Expected Output',
        }));
        expectedOutputLines.length = 0;
      }
      collectingExpectedOutput = false;
      afterSolution = true;
    } else if (/^sensAI$/i.test(text)) {
      continue;
    } else if (/^(Explain this code|Would you like EXPLAIN|Want to understand)/i.test(text)) {
      aiMode = true;
    } else if (/^(Would you like|View full solution|Here is the solution)/i.test(text)) {
      continue;
    } else if (collectingExpectedOutput) {
      expectedOutputLines.push(text);
    } else if (instructions.length === 0 && /^(Problem|PROBLEM|PROGRAM)$/i.test(title)) {
      exerciseTitle = text;
      instructions.push(text);
    } else if (!afterSolution) {
      instructions.push(text);
    }
  }

  if (expectedOutputLines.length) {
    blocks.push(block('code', {
      language: 'text',
      code: expectedOutputLines.join('\n'),
      caption: 'Expected Output',
    }));
  }

  const starterCode = `# ${exerciseTitle}\n# Write your solution below\n`;
  const exerciseBlock = block('exercise', {
    title: exerciseTitle,
    instructions: {
      content: instructions.join('\n\n'),
      format: 'markdown',
    },
    objectives: objectives.length ? objectives : [instructions[0] || exerciseTitle],
    difficulty: 'easy',
    hints,
    starterFiles: [{ name: 'main.py', content: starterCode }],
    actionLabel: 'Start exercise',
  });
  const expectedOutput = blocks.find((item) =>
    item.type === 'code' && /Expected Output/i.test(item.caption))?.code ?? '';
  if (solutionCode) {
    blocks.push(block('solution', {
      title: 'View solution',
      description: solutionExplanation,
      language: 'python',
      code: solutionCode,
    }));
  }
  const compilerBlock = block('compiler', {
    language: 'python',
    runtime: 'python3',
    files: [{ name: 'main.py', content: starterCode }],
    activeFile: 'main.py',
    expectedOutput,
    ...(inputLines.length ? { stdin: inputLines.join('\n') } : {}),
    validation: { type: 'normalized_output' },
    runLabel: 'Run code',
    resetLabel: 'Reset starter code',
  });

  blocks.unshift(exerciseBlock, compilerBlock);

  return blocks;
}

function createStandardLesson($, nodes, block) {
  const blocks = [];
  let pendingCaption = '';
  let aiMode = false;

  for (const node of nodes) {
    const text = normalizedText($, node);
    if (!text && !$(node).find('img').length) continue;

    if ($(node).is('ul, ol')) {
      const items = $(node).find('li').map((_, item) => normalizedText($, item)).get();
      blocks.push(block('paragraph', {
        content: items.map((item) => `- ${item}`).join('\n'),
        format: 'markdown',
      }));
      continue;
    }

    if ($(node).is('table')) {
      const grid = tableGrid($, node);
      const lines = tableLines($, node);
      const firstLine = lines[0] ?? '';

      if (aiMode) {
        blocks.push(block('ai_explanation', {
          title: 'AI Explanation',
          context: lines.join('\n\n'),
          actionLabel: 'Explain this code',
          suggestedPrompts: ['Explain this example step by step.'],
        }));
        aiMode = false;
      } else if (grid.some((row) => row.length > 1)) {
        const width = Math.max(...grid.map((row) => row.length));
        blocks.push(block('table', {
          caption: pendingCaption,
          columns: Array.from({ length: width }, (_, index) => ({
            key: `column-${index + 1}`,
            header: `Column ${index + 1}`,
            align: 'left',
          })),
          rows: grid.map((row) => Object.fromEntries(
            row.map((cell, index) => [`column-${index + 1}`, cell]),
          )),
        }));
      } else {
        const output = /^(Expected )?Output$/i.test(firstLine) || /output/i.test(pendingCaption);
        const code = (output ? lines.slice(1) : lines).join('\n');
        if (/^(Note:|Remember:)/i.test(code)) {
          const [label, ...content] = code.split(':');
          const iconSrc = $(node).find('img').first().attr('src');
          blocks.push(block('note', {
            title: label,
            content: content.join(':').trim(),
            format: 'plain',
            ...(iconSrc ? { iconSrc, iconAlt: '' } : {}),
          }));
        } else if (code) {
          blocks.push(block('code', {
            language: output ? 'text' : 'python',
            code,
            caption: output ? (pendingCaption || firstLine) : (pendingCaption || 'Example'),
          }));
        }
      }
      pendingCaption = '';
      continue;
    }

    const image = $(node).find('img').first();
    if (image.length) {
      const precedingCaption = blocks.at(-1)?.type === 'paragraph'
        && /^Figure:/i.test(blocks.at(-1).content)
        ? blocks.pop().content
        : '';
      blocks.push(block('image', {
        src: image.attr('src'),
        alt: image.attr('alt') || (precedingCaption || text).replace(/^Figure:\s*/i, ''),
        caption: precedingCaption || text || image.attr('alt') || '',
        loading: 'lazy',
      }));
      continue;
    }

    if (/^(Example|Output|Expected Output)$/i.test(text)) {
      pendingCaption = text;
    } else if (/^sensAI$/i.test(text) || /^Explain this code$/i.test(text)) {
      aiMode = true;
    } else if (/^Note:/i.test(text)) {
      blocks.push(block('note', {
        title: 'Note',
        content: text.replace(/^Note:\s*/i, ''),
        format: 'plain',
      }));
    } else if (/^(Warning|Be careful|Important):?/i.test(text)) {
      blocks.push(block('warning', {
        title: text.split(':')[0],
        content: text.includes(':') ? text.slice(text.indexOf(':') + 1).trim() : text,
        format: 'plain',
      }));
    } else if ($(node).find('strong').length && text.length < 90) {
      blocks.push(block('heading', { level: 3, text }));
    } else {
      blocks.push(block('paragraph', paragraphText($, node)));
    }
  }

  for (let index = 0; index < blocks.length - 1; index += 1) {
    const image = blocks[index];
    const caption = blocks[index + 1];
    if (image.type === 'image' && !image.alt && caption.type === 'paragraph' && /^Figure:/i.test(caption.content)) {
      image.alt = caption.content.replace(/^Figure:\s*/i, '');
      image.caption = caption.content;
      blocks.splice(index + 1, 1);
    }
  }

  for (const codeBlock of blocks.filter(({ type }) => type === 'code')) {
    const runnableConfig = runnableExamples.get(codeBlock.id);
    if (!runnableConfig) continue;
    codeBlock.mode = 'runnable';
    if (runnableConfig.stdin) codeBlock.stdin = runnableConfig.stdin;
  }

  const runnableExample = blocks.find((item) => item.type === 'code' && item.mode === 'runnable');
  if (runnableExample) {
    const index = blocks.indexOf(runnableExample);
    blocks.splice(index + 1, 0, block('compiler', {
      language: 'python',
      runtime: 'python3',
      starterCode: runnableExample.code,
      ...(runnableExample.stdin ? { stdin: runnableExample.stdin } : {}),
      runLabel: 'Run example',
      resetLabel: 'Reset example',
    }));
  }

  return blocks;
}

function estimateLessonMinutes(blocks) {
  if (blocks.some(({ type }) => type === 'exercise')) return 12;
  if (blocks.some(({ type }) => type === 'quiz')) return 4;
  return Math.max(4, Math.min(10, Math.ceil(blocks.length * 0.8)));
}

await mkdir(ASSET_DIRECTORY, { recursive: true });
let imageNumber = 0;
const extractedImages = new Map();

const conversion = await mammoth.convertToHtml(
  { path: SOURCE_PATH },
  {
    convertImage: mammoth.images.imgElement(async (image) => {
      const content = await image.readAsBuffer();
      const hash = createHash('sha256').update(content).digest('hex');
      if (extractedImages.has(hash)) return { src: extractedImages.get(hash) };
      const extension = image.contentType === 'image/jpeg'
        ? 'jpg'
        : image.contentType.split('/')[1];
      const filename = `python-foundations-image-${String(++imageNumber).padStart(2, '0')}.${extension}`;
      const destination = resolve(ASSET_DIRECTORY, filename);
      await writeFile(destination, content);
      const source = `/assets/courses/python-foundations/${filename}`;
      extractedImages.set(hash, source);
      return { src: source };
    }),
  },
);

const conversionErrors = conversion.messages.filter((message) => message.type === 'error');
if (conversionErrors.length) {
  throw new Error(conversionErrors.map((message) => message.message).join('\n'));
}

const $ = load(conversion.value);
const children = $('body').children().toArray();
const modules = new Map();
let lessonCount = 0;

for (let index = 0; index < children.length; index += 1) {
  const pageMatch = normalizedText($, children[index]).match(/^PAGE\s+(\d+)\.(\d+)$/i);
  if (!pageMatch) continue;

  const pageNumber = `${pageMatch[1]}.${pageMatch[2]}`;
  const moduleNumber = Number(pageMatch[1]);
  const lessonNumber = Number(pageMatch[2]);
  const title = normalizedText($, children[index + 1]);
  const nodes = [];

  for (let cursor = index + 2; cursor < children.length; cursor += 1) {
    const cursorText = normalizedText($, children[cursor]);
    if (/^PAGE\s+\d+\.\d+$/i.test(cursorText) || (pageNumber === '9.7' && cursorText === 'Congratulations')) break;
    nodes.push(children[cursor]);
  }

  const block = createBlockFactory(pageNumber);
  const hasExpectedOutput = nodes.some((node) => /Expected Output/i.test(normalizedText($, node)));
  const isExercise = hasExpectedOutput || /^(Problem|PROBLEM|PROGRAM)$/i.test(title);
  const isQuiz = /^Quiz:/i.test(title);
  const blocks = isQuiz
    ? createQuizLesson($, pageNumber, title, nodes, block)
    : isExercise
      ? createExerciseLesson($, pageNumber, title, nodes, block)
      : createStandardLesson($, nodes, block);

  const firstParagraph = blocks.find((item) =>
    item.type === 'paragraph' || item.type === 'exercise' || item.type === 'quiz',
  );
  const summary = firstParagraph?.content
    || firstParagraph?.instructions?.content?.split('\n\n')[0]
    || firstParagraph?.question
    || title;
  const lessonId = `lesson-${pageMatch[1]}-${pageMatch[2]}-${slugify(title).slice(0, 55)}`;

  if (!modules.has(moduleNumber)) {
    modules.set(moduleNumber, {
      id: `module-${moduleNumber}-${slugify(moduleTitles[moduleNumber])}`,
      title: `Module ${moduleNumber} — ${moduleTitles[moduleNumber]}`,
      description: `Lessons ${moduleNumber}.1 through ${moduleNumber}.${lessonNumber}`,
      initiallyExpanded: moduleNumber === 1,
      lessons: [],
    });
  }

  modules.get(moduleNumber).lessons.push({
    id: lessonId,
    number: pageNumber,
    title,
    summary: summary.slice(0, 280),
    status: 'available',
    estimatedMinutes: estimateLessonMinutes(blocks),
    tags: [slugify(moduleTitles[moduleNumber])],
    blocks,
  });
  lessonCount += 1;
}

const tailStart = children.findIndex((element) => normalizedText($, element) === 'Congratulations');
const tailSections = [
  ['9.8', 'Congratulations', 'Congratulations', 'Data Types'],
  ['9.9', 'Review: Data Types', 'Data Types', 'Variables'],
  ['9.10', 'Review: Variables', 'Variables', 'Operators'],
  ['9.11', 'Review: Operators', 'Operators', 'Take input'],
  ['9.12', 'Review: User Input', 'Take input', 'Data conversion'],
  ['9.13', 'Review: Data Conversion', 'Data conversion', 'Moving Forward'],
  ['9.14', 'Moving Forward', 'Moving Forward', 'FINISH'],
  ['9.15', 'Finish', 'FINISH', null],
];

if (tailStart >= 0) {
  for (const [number, title, startLabel, endLabel] of tailSections) {
    const start = children.findIndex((element, index) =>
      index >= tailStart && normalizedText($, element) === startLabel);
    const end = endLabel
      ? children.findIndex((element, index) =>
        index > start && normalizedText($, element) === endLabel)
      : children.length;
    if (start < 0) continue;
    const nodes = children.slice(start + 1, end < 0 ? children.length : end);
    const block = createBlockFactory(number);
    const blocks = createStandardLesson($, nodes, block);
    if (!blocks.length) blocks.push(block('callout', {
      tone: 'success',
      title: 'Finish',
      content: 'FINISH',
      format: 'plain',
    }));
    modules.get(9).lessons.push({
      id: `lesson-${number.replace('.', '-')}-${slugify(title)}`,
      number,
      title,
      summary: normalizedText($, nodes.find((node) => normalizedText($, node))) || title,
      status: 'available',
      estimatedMinutes: estimateLessonMinutes(blocks),
      tags: [slugify(moduleTitles[9])],
      blocks,
    });
    lessonCount += 1;
  }
}

for (const [moduleNumber, module] of modules) {
  const lastLesson = module.lessons.at(-1);
  module.description = `Lessons ${moduleNumber}.1 through ${lastLesson.number}`;
}

const chapterGroups = [...modules.entries()].flatMap(([sourceGroupNumber, sourceGroup]) => {
  const groups = sourceGroupNumber === 9
    ? [
        { groupNumber: 9, lessons: sourceGroup.lessons.slice(0, 7) },
        { groupNumber: 10, lessons: sourceGroup.lessons.slice(7) },
      ]
    : [{ groupNumber: sourceGroupNumber, lessons: sourceGroup.lessons }];
  return groups.map(({ groupNumber, lessons }) => ({
    id: `chapter-1-${groupNumber}-${slugify(chapterGroupTitles[groupNumber].replace(/^1\.\d+\s+/, ''))}`,
    title: chapterGroupTitles[groupNumber],
    description: `Lessons ${lessons[0].number} through ${lessons.at(-1).number}`,
    initiallyExpanded: groupNumber === 1,
    lessons,
  }));
});
const courseModules = [{
  id: 'module-1-getting-started-with-python',
  title: 'CH 1: Getting Started with Python',
  description: 'Python foundations organized into ten chapter groups.',
  initiallyExpanded: true,
  sections: chapterGroups,
}];

const course = {
  $schema: '../../schemas/learning-course.schema.json',
  schemaVersion: '1.0.0',
  id: 'python',
  slug: 'python',
  title: 'Python Foundations',
  description: 'Learn Python fundamentals through explanations, runnable examples, quizzes, and guided coding exercises. No prior programming experience is required.',
  locale: 'en-US',
  status: 'published',
  metadata: {
    version: '1.0.0',
    authors: [{ name: 'MI Tutora' }],
    level: 'beginner',
    estimatedMinutes: 752,
    tags: ['python', 'programming', 'fundamentals'],
    updatedAt: '2026-08-16T00:00:00.000Z',
  },
  navigation: {
    defaultLessonId: chapterGroups[0].lessons[0].id,
    sequence: 'module-order',
    skipLockedLessons: true,
    labels: {
      previous: 'Previous lesson',
      next: 'Next lesson',
      progress: 'Course progress',
      currentLesson: 'Current lesson',
    },
  },
  modules: courseModules,
};

const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(schema);

if (!validate(course)) {
  throw new Error(ajv.errorsText(validate.errors, { separator: '\n' }));
}

const firebaseVersion = `v${course.metadata.version.split('.')[0]}`;
const outputDirectory = resolve(FIREBASE_OUTPUT_ROOT, firebaseVersion);
const moduleFiles = course.modules.map((_, index) => `module-${index + 1}.json`);
const { modules: generatedModules, ...courseManifest } = course;
const courseOutline = generatedModules.map((module) => ({
  ...module,
  sections: module.sections.map((section) => ({
    ...section,
    lessons: section.lessons.map((lesson) => ({ ...lesson, blocks: [] })),
  })),
}));

await mkdir(outputDirectory, { recursive: true });
for (const filename of await readdir(outputDirectory)) {
  if (/^module-\d+\.json$/.test(filename) && !moduleFiles.includes(filename)) {
    await unlink(resolve(outputDirectory, filename));
  }
}
await writeFile(PUBLIC_COURSE_PATH, `${JSON.stringify(course, null, 2)}\n`);
const localMetadata = JSON.parse(await readFile(LOCAL_METADATA_PATH, 'utf8'));
localMetadata.courses = localMetadata.courses.map((entry) => entry.id === course.id ? {
  ...entry,
  title: course.title,
  description: course.description,
  version: course.metadata.version,
  source: '/courses/python-course.json',
} : entry);
await writeFile(LOCAL_METADATA_PATH, `${JSON.stringify(localMetadata, null, 2)}\n`);
await writeFile(
  resolve(outputDirectory, 'course.json'),
  `${JSON.stringify({ ...courseManifest, modules: courseOutline, moduleFiles }, null, 2)}\n`,
);
await Promise.all(generatedModules.map((module, index) =>
  writeFile(resolve(outputDirectory, moduleFiles[index]), `${JSON.stringify(module, null, 2)}\n`)));
const publishingMetadata = {
  id: course.id,
  slug: course.slug,
  title: course.title,
  description: course.description,
  thumbnail: '/assets/courses/python-foundations/python-foundations-image-01.png',
  language: 'python',
  domain: 'programming',
  difficulty: course.metadata.level,
  estimatedMinutes: course.metadata.estimatedMinutes,
  moduleCount: course.modules.length,
  lessonCount,
  published: true,
  version: firebaseVersion,
  storagePath: 'course-content/python',
};
await mkdir(FIREBASE_METADATA_ROOT, { recursive: true });
await writeFile(
  resolve(FIREBASE_METADATA_ROOT, 'python.json'),
  `${JSON.stringify(publishingMetadata, null, 2)}\n`,
);

console.log(JSON.stringify({
  output: outputDirectory,
  manifest: 'course.json',
  moduleFiles,
  metadata: resolve(FIREBASE_METADATA_ROOT, 'python.json'),
  modules: course.modules.length,
  lessons: lessonCount,
  sections: chapterGroups.length,
  blocks: chapterGroups.flatMap((group) => group.lessons).flatMap((lesson) => lesson.blocks).length,
  images: imageNumber,
  validation: 'passed',
}, null, 2));
