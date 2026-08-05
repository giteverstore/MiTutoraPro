export function parseJson(text, fileUrl) {
  if (!import.meta.env.DEV) return JSON.parse(text);

  try {
    return JSON.parse(text);
  } catch (error) {
    console.group('JSON.parse failed');
    console.error(error);
    console.log('File:', fileUrl);
    console.log('Input type:', typeof text);
    console.log('Input length:', typeof text === 'string' ? text.length : 'N/A');
    console.log('First 200 chars:', typeof text === 'string' ? text.slice(0, 200) : text);
    console.log('Last 200 chars:', typeof text === 'string' ? text.slice(-200) : text);
    console.trace();
    console.groupEnd();
    throw error;
  }
}
