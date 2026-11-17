const SAFE=/^[a-z0-9][a-z0-9._-]{0,127}$/i;
export function createV2ProgressKey({contentId,publicationVersion}={}){if(!SAFE.test(String(contentId??''))||!Number.isSafeInteger(publicationVersion)||publicationVersion<1)throw new TypeError('Valid V2 progress identity required.');return `v2_course_${contentId}_version_${publicationVersion}`;}
