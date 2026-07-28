import mammoth from 'mammoth';
import { load } from 'cheerio';

let imageCount = 0;
const result = await mammoth.convertToHtml(
  { path: 'MI TUtora PythonCourse.docx' },
  {
    convertImage: mammoth.images.imgElement(async (image) => ({
      src: `IMAGE_${++imageCount}.${image.contentType.split('/')[1]}`,
    })),
  },
);

const $ = load(result.value);
const pages = [];

$('p').each((_, element) => {
  const text = $(element).text().trim();
  if (/^PAGE\s+\d+(?:\.\d+)+$/i.test(text)) pages.push(text);
});

console.log({
  htmlCharacters: result.value.length,
  images: imageCount,
  pages: pages.length,
  firstPages: pages.slice(0, 10),
  lastPages: pages.slice(-10),
  tables: $('table').length,
  paragraphs: $('p').length,
  lists: $('ul, ol').length,
  headings: $('h1, h2, h3, h4, h5, h6').length,
  tags: [...new Set($('*').map((_, element) => element.tagName).get())],
});

const lessonSummaries = [];
$('body > p').each((_, element) => {
  const pageText = $(element).text().trim();
  if (!/^PAGE\s+\d+(?:\.\d+)+$/i.test(pageText)) return;

  const titleElement = $(element).next();
  const content = [];
  let cursor = titleElement.next();
  let tableCount = 0;
  let lessonImageCount = 0;

  while (cursor.length && !/^PAGE\s+\d+(?:\.\d+)+$/i.test(cursor.text().trim())) {
    const text = cursor.text().replace(/\s+/g, ' ').trim();
    if (text) content.push(text);
    tableCount += cursor.is('table') ? 1 : cursor.find('table').length;
    lessonImageCount += cursor.is('img') ? 1 : cursor.find('img').length;
    cursor = cursor.next();
  }

  lessonSummaries.push({
    page: pageText.replace(/^PAGE\s+/i, ''),
    title: titleElement.text().replace(/\s+/g, ' ').trim(),
    elements: content.length,
    tables: tableCount,
    images: lessonImageCount,
    signals: content.filter((text) =>
      /quiz|exercise|expected output|output|ai explanation|example/i.test(text),
    ).slice(0, 8),
  });
});

console.log(JSON.stringify(lessonSummaries, null, 2));
