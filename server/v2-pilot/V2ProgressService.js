import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createV2ProgressKey } from './v2ProgressIdentity.js';

export class V2ProgressError extends Error { constructor(code,message,status=400){super(message);this.code=code;this.status=status;} }
const uniqueStrings=(value,label)=>{if(!Array.isArray(value)||value.length>200||value.some(x=>typeof x!=='string'||!x||x.length>128))throw new V2ProgressError('v2/progress-invalid',`${label} is invalid.`);return [...new Set(value)]};

export class FirestoreV2ProgressStore {
  constructor(db=getFirestore()){this.db=db;}
  reference(uid,identity){return this.db.doc(`users/${uid}/v2CourseProgress/${createV2ProgressKey(identity)}`);}
  async load(uid,identity){const snap=await this.reference(uid,identity).get();return snap.exists?snap.data():null;}
  async save(uid,identity,input,validLessonIds){const completed=uniqueStrings(input.completedLessons??[],'completedLessons'),bookmarks=uniqueStrings(input.bookmarks??[],'bookmarks'),current=input.currentLesson??null;
    for(const id of [...completed,...bookmarks,...(current?[current]:[])])if(!validLessonIds.has(id))throw new V2ProgressError('v2/progress-invalid-lesson','Progress references a lesson outside this publication.',422);
    const expected=Number(input.revision??0),ref=this.reference(uid,identity);return this.db.runTransaction(async tx=>{const snap=await tx.get(ref),existing=snap.exists?snap.data():null,currentRevision=Number(existing?.revision??0);if(currentRevision!==expected)throw new V2ProgressError('v2/progress-conflict','Progress was updated by another session.',409);const record={namespace:'v2',contentType:'course',contentId:identity.contentId,publicationVersion:identity.publicationVersion,completedLessons:completed,currentLesson:current,bookmarks,revision:currentRevision+1,createdAt:existing?.createdAt??FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};tx.set(ref,record);return {...record,createdAt:existing?.createdAt??null,updatedAt:null};});}
}
