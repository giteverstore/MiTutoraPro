import {describe,expect,it,vi} from 'vitest';
import {FirestoreV2ProgressStore} from '../../server/v2-pilot/V2ProgressService';
import {createV2ProgressKey} from '../../server/v2-pilot/v2ProgressIdentity';

function database(initial=null){let value=initial;const ref={async get(){return{exists:Boolean(value),data:()=>value}}};return{doc:vi.fn(()=>ref),async runTransaction(operation){return operation({get:ref.get,set:(_ref,next)=>{value=next}})},value:()=>value};}
describe('server V2 progress',()=>{
  it('uses deterministic namespace/version isolated paths',()=>{expect(createV2ProgressKey({contentId:'course-a',publicationVersion:2})).toBe('v2_course_course-a_version_2')});
  it('creates and updates with optimistic revision',async()=>{const db=database(),store=new FirestoreV2ProgressStore(db),identity={contentId:'course-a',publicationVersion:1},lessons=new Set(['l1']);const created=await store.save('u1',identity,{revision:0,completedLessons:['l1'],bookmarks:[]},lessons);expect(created.revision).toBe(1);await expect(store.save('u1',identity,{revision:0,completedLessons:[],bookmarks:[]},lessons)).rejects.toMatchObject({code:'v2/progress-conflict'});expect(db.doc).toHaveBeenCalledWith('users/u1/v2CourseProgress/v2_course_course-a_version_1')});
  it('rejects lesson IDs outside the immutable version',async()=>{const store=new FirestoreV2ProgressStore(database());await expect(store.save('u1',{contentId:'c',publicationVersion:1},{revision:0,completedLessons:['other'],bookmarks:[]},new Set(['l1']))).rejects.toMatchObject({code:'v2/progress-invalid-lesson'})});
});
