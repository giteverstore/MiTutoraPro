import mammoth from 'mammoth';
import { load } from 'cheerio';

const requestedPage = process.argv[2];
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
let collecting = false;

$('body').children().each((index, element) => {
  const node = $(element);
  const text = node.text().replace(/\s+/g, ' ').trim();
  const pageMatch = text.match(/^PAGE\s+(\d+(?:\.\d+)+)$/i);

  if (pageMatch) {
    if (collecting) return false;
    collecting = pageMatch[1] === requestedPage;
  }

  if (!collecting) return;

  console.log(JSON.stringify({
    index,
    tag: element.tagName,
    text,
    strong: node.find('strong').length > 0,
    list: node.is('ul, ol'),
    image: node.find('img').attr('src') ?? null,
    html: $.html(element).slice(0, 1000),
  }, null, 2));
});
