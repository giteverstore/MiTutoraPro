import mammoth from 'mammoth';
import { load } from 'cheerio';

const result = await mammoth.convertToHtml(
  { path: 'MI TUtora PythonCourse.docx' },
  { convertImage: mammoth.images.imgElement(async () => ({ src: 'image' })) },
);
const $ = load(result.value);
const children = $('body').children().toArray();

for (let index = 0; index < children.length; index += 1) {
  const page = $(children[index]).text().trim().match(/^PAGE\s+(\d+(?:\.\d+)+)$/i);
  if (!page) continue;

  const title = $(children[index + 1]).text().replace(/\s+/g, ' ').trim();
  if (!/^quiz:/i.test(title)) continue;

  const tables = [];
  for (let cursor = index + 2; cursor < children.length; cursor += 1) {
    if (/^PAGE\s+/i.test($(children[cursor]).text().trim())) break;
    if ($(children[cursor]).is('table')) {
      tables.push(
        $(children[cursor]).find('p').map((_, p) => $(p).text().replace(/\s+/g, ' ').trim()).get(),
      );
    }
  }

  console.log(`\n${page[1]} ${title}`);
  tables.forEach((table, tableIndex) => console.log(`  ${tableIndex}: ${table.join(' | ')}`));
}
