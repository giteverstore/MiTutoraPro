import { verifyFirebaseIdToken } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { FirestoreV2ProgressStore, V2ProgressError } from './V2ProgressService.js';
import { assertPilotEntitlement, HttpV2DeliveryTransport, isServerV2PilotEnabled, V2PilotGatewayError } from './V2PilotGateway.js';
import { createV2GatewayFirebaseCredentialContext, createV2ProgressFirebaseCredentialContext } from './ServiceAssertion.js';
import { createDefaultFirestore } from '../firestore/createDefaultFirestore.js';

function bearer(request) {
  const header = request.headers?.authorization ?? request.headers?.Authorization;
  const match = typeof header === 'string' && header.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new V2ProgressError('v2/auth-required', 'Sign in to access V2 progress.', 401);
  return match[1];
}
function diagnostic(error) { return { errorName:String(error?.name ?? 'Error').slice(0,80), errorCode:typeof error?.code === 'string' || typeof error?.code === 'number' ? String(error.code).slice(0,80) : null }; }

export function createV2ProgressHandler({ environment=process.env, verifyToken=verifyFirebaseIdToken, store=null, transport=new HttpV2DeliveryTransport(environment), authCredentialFactory=createV2GatewayFirebaseCredentialContext, progressCredentialFactory=createV2ProgressFirebaseCredentialContext, firestoreFactory=createDefaultFirestore, logger=console }={}) {
  return async function handler(request,response) {
    let session; let stage='request';
    try {
      if(!isServerV2PilotEnabled(environment)) throw new V2ProgressError('v2/pilot-disabled','V2 pilot is disabled.',404);
      stage='bearer'; const token=bearer(request);
      stage='auth-credential'; const authCredentials=authCredentialFactory({request,environment});
      stage='firebase-token'; const decoded=await verifyToken(token,{environment,googleCredentials:authCredentials});
      if(!decoded?.uid) throw new V2ProgressError('v2/auth-invalid','The learner session is invalid.',401);
      const contentId=String(request.query?.contentId??''), publicationVersion=Number(request.query?.version);
      stage='pilot-authorization'; assertPilotEntitlement({uid:decoded.uid,contentId},environment);
      const identity={contentId,publicationVersion}; let progressStore=store;
      if(!progressStore) {
        stage='progress-credential'; const progressCredentials=progressCredentialFactory({request,environment});
        if(!progressCredentials?.firebaseCredential) throw new V2ProgressError('v2/service-auth-unavailable','V2 progress persistence identity is unavailable.',503);
        stage='firestore-client'; session=await firestoreFactory(environment,progressCredentials); progressStore=new FirestoreV2ProgressStore(session.db);
      }
      if(request.method==='GET') { stage='progress-read'; return response.status(200).json({ok:true,data:await progressStore.load(decoded.uid,identity)}); }
      if(request.method!=='PUT') { response.setHeader('Allow','GET, PUT'); throw new V2ProgressError('v2/method-not-allowed','Use GET or PUT.',405); }
      stage='exact-version'; const delivery=await transport.request({kind:'course',contentId,publicationVersion,mode:'exact'},{correlationId:crypto.randomUUID()});
      const lessonIds=new Set((delivery.course?.modules??[]).flatMap(module=>module.sections?.length?module.sections.flatMap(section=>(section.lessons??[]).map(lesson=>lesson.id)):(module.lessons??[]).map(lesson=>lesson.id)));
      stage='progress-write'; return response.status(200).json({ok:true,data:await progressStore.save(decoded.uid,identity,request.body??{},lessonIds)});
    } catch(error) {
      const typed=error instanceof V2ProgressError||error instanceof V2PilotGatewayError, authenticationStage=stage==='bearer'||stage==='firebase-token';
      const publicError=typed?error:authenticationStage?new V2ProgressError('v2/auth-invalid','The learner session is invalid.',401):new V2ProgressError('v2/progress-unavailable','V2 progress persistence is temporarily unavailable.',503);
      logger.warn?.('v2_progress.failure',{stage,...diagnostic(error),publicCode:publicError.code,status:publicError.status});
      return response.status(publicError.status).json({ok:false,error:{code:publicError.code,message:publicError.message}});
    } finally { await session?.close(); }
  };
}
