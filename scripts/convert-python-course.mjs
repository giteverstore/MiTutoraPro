import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { load } from 'cheerio';
import mammoth from 'mammoth';

const SOURCE_PATH = resolve('MI TUtora PythonCourse.docx');
const FIREBASE_OUTPUT_ROOT = resolve('firebase-content/course-content/python');
const FIREBASE_METADATA_ROOT = resolve('firebase-content/firestore/courses');
const ASSET_DIRECTORY = resolve('public/assets/courses/python-course');
const SCHEMA_PATH = resolve('schemas/learning-course.schema.json');

const moduleTitles = {
  1: 'Getting Started with Python',
  2: 'Python Data Types',
  3: 'Python Comments',
  4: 'Python Variables',
  5: 'Python Output and f-strings',
  6: 'Python Operators',
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
};

const repairedCodeOutput = {
  'page-2-7-code-4': '5',
  'page-2-7-code-8': '343.44',
  'page-2-8-code-3': '5',
  'page-2-8-code-12': '8',
  'page-2-8-code-15': '53',
  'page-4-4-code-3': 'Merry Christmas',
  'page-4-16-code-3': "NameError: name 'city2' is not defined",
  'page-5-3-code-3': 'Name: Jack',
  'page-5-10-code-4': 'My name is Alice and I live in Wonderland.',
  'page-5-10-code-9': '# 12->Alice #',
  'page-6-8-code-3': '50',
  'page-6-8-code-6': '55.0',
  'page-6-10-code-3': '6.25',
  'page-6-10-code-6': '5.0',
};

function repairConvertedBlocks(modules) {
  for (const module of modules) {
    for (const lesson of module.lessons) {
      lesson.blocks = lesson.blocks.map((block) => {
        if (block.type === 'code' && repairedCodeOutput[block.id]) {
          return { ...block, code: repairedCodeOutput[block.id] };
        }

        if (
          block.type === 'code'
          && block.language === 'python'
          && /^(Note:|Remember:)/.test(block.code.trim())
        ) {
          const [label, ...content] = block.code.split(':');
          return {
            id: block.id.replace('-code-', '-note-'),
            type: 'note',
            title: label,
            content: content.join(':').trim(),
            format: 'plain',
          };
        }

        return block;
      });
    }
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'content';
}

function normalizedText($, element) {
  return $(element).text().replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function tableLines($, table) {
  return $(table)
    .find('p')
    .map((_, paragraph) => normalizedText($, paragraph))
    .get()
    .filter(Boolean)
    .filter((line) => !/^Run Code\s*>>$/i.test(line));
}

function tableGrid($, table) {
  return $(table).find('tr').toArray().map((row) =>
    $(row).find('td, th').toArray().map((cell) => normalizedText($, cell)),
  );
}

function createBlockFactory(pageNumber) {
  let sequence = 0;
  return (type, data) => ({
    id: `${slugify(`page-${pageNumber}`)}-${slugify(type)}-${++sequence}`,
    type,
    ...data,
  });
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

function createExerciseLesson($, title, nodes, block) {
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

      if (isExpectedOutput) {
        blocks.push(block('code', {
          language: 'text',
          code: lines.slice(1).join('\n'),
          caption: 'Expected Output',
        }));
        collectingExpectedOutput = false;
      } else if (aiMode) {
        blocks.push(block('ai_explanation', {
          title: 'AI Explanation',
          context: lines.join('\n\n'),
          actionLabel: 'Explain this code',
          suggestedPrompts: ['Explain the solution step by step.'],
        }));
        aiMode = false;
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
  const compilerBlock = block('compiler', {
    language: 'python',
    runtime: 'python3',
    files: [{ name: 'main.py', content: starterCode }],
    activeFile: 'main.py',
    expectedOutput,
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
        blocks.push(block('code', {
          language: output ? 'text' : 'python',
          code: (output ? lines.slice(1) : lines).join('\n'),
          caption: output ? (pendingCaption || firstLine) : (pendingCaption || 'Example'),
        }));
      }
      pendingCaption = '';
      continue;
    }

    const image = $(node).find('img').first();
    if (image.length) {
      blocks.push(block('image', {
        src: image.attr('src'),
        alt: image.attr('alt') || text.replace(/^Figure:\s*/i, ''),
        caption: text || image.attr('alt') || '',
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
      blocks.push(block('paragraph', { content: text, format: 'plain' }));
    }
  }

  return blocks;
}

await mkdir(ASSET_DIRECTORY, { recursive: true });
let imageNumber = 0;

const conversion = await mammoth.convertToHtml(
  { path: SOURCE_PATH },
  {
    convertImage: mammoth.images.imgElement(async (image) => {
      const extension = image.contentType === 'image/jpeg'
        ? 'jpg'
        : image.contentType.split('/')[1];
      const filename = `python-course-image-${String(++imageNumber).padStart(2, '0')}.${extension}`;
      const destination = resolve(ASSET_DIRECTORY, filename);
      await writeFile(destination, await image.readAsBuffer());
      return { src: `/assets/courses/python-course/${filename}` };
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
    if (/^PAGE\s+\d+\.\d+$/i.test(normalizedText($, children[cursor]))) break;
    nodes.push(children[cursor]);
  }

  const block = createBlockFactory(pageNumber);
  const hasExpectedOutput = nodes.some((node) => /Expected Output/i.test(normalizedText($, node)));
  const isExercise = hasExpectedOutput || /^(Problem|PROBLEM|PROGRAM)$/i.test(title);
  const isQuiz = /^Quiz:/i.test(title);
  const blocks = isQuiz
    ? createQuizLesson($, pageNumber, title, nodes, block)
    : isExercise
      ? createExerciseLesson($, title, nodes, block)
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
      title: `Module ${moduleNumber}: ${moduleTitles[moduleNumber]}`,
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
    estimatedMinutes: 5,
    tags: [slugify(moduleTitles[moduleNumber])],
    blocks,
  });
  lessonCount += 1;
}

for (const [moduleNumber, module] of modules) {
  const lastLesson = module.lessons.at(-1);
  module.description = `Lessons ${moduleNumber}.1 through ${lastLesson.number}`;
}

const course = {
  $schema: '../../schemas/learning-course.schema.json',
  schemaVersion: '1.0.0',
  id: 'python',
  slug: 'python',
  title: 'MI Tutora Python Course',
  description: 'A beginner Python course converted from the MI Tutora course document.',
  locale: 'en-US',
  status: 'draft',
  metadata: {
    version: '1.0.0',
    authors: [{ name: 'MI Tutora' }],
    level: 'beginner',
    estimatedMinutes: lessonCount * 5,
    tags: ['python', 'programming', 'beginner'],
    updatedAt: new Date().toISOString(),
  },
  navigation: {
    defaultLessonId: modules.get(1).lessons[0].id,
    sequence: 'module-order',
    skipLockedLessons: true,
    labels: {
      previous: 'Previous lesson',
      next: 'Next lesson',
      progress: 'Course progress',
      currentLesson: 'Current lesson',
    },
  },
  modules: [...modules.values()],
};

repairConvertedBlocks(course.modules);

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
const { modules: courseModules, ...courseManifest } = course;
const courseOutline = courseModules.map((module) => ({
  ...module,
  lessons: module.lessons.map((lesson) => ({ ...lesson, blocks: [] })),
}));

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, 'course.json'),
  `${JSON.stringify({ ...courseManifest, modules: courseOutline, moduleFiles }, null, 2)}\n`,
);
await Promise.all(courseModules.map((module, index) =>
  writeFile(resolve(outputDirectory, moduleFiles[index]), `${JSON.stringify(module, null, 2)}\n`)));
const publishingMetadata = {
  id: course.id,
  slug: course.slug,
  title: course.title,
  description: course.description,
  thumbnail: '/assets/courses/python-course/python-course-image-01.png',
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
  blocks: course.modules.flatMap((module) => module.lessons).flatMap((lesson) => lesson.blocks).length,
  images: imageNumber,
  validation: 'passed',
}, null, 2));
