# Firebase content publishing

The course publisher validates and deploys generated course bundles without manual Firebase Console uploads.

## Credentials

The publisher uses the Firebase Admin SDK and Application Default Credentials. Configure the target project and bucket through environment variables:

```dotenv
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
GOOGLE_APPLICATION_CREDENTIALS=C:\path\outside\the\repository\service-account.json
```

CI may provide the service-account object through the secret `FIREBASE_SERVICE_ACCOUNT_JSON` instead. Never commit either credential form. The existing Vite project and bucket variables are accepted as fallbacks, but browser API keys are not Admin credentials.

The service account needs permission to create/update `courses/{courseId}` and manage objects in the configured Storage bucket.

## Publish a course

Generate the bundle, run a credential-free preflight, and publish:

```powershell
npm run convert:python-course
npm run publish-course -- python --dry-run
npm run publish-course -- python
```

The CLI also accepts `npm run publish-course python` with npm versions that forward positional arguments. Using `--` is the portable form.

For `python`, the publisher reads:

```text
firebase-content/firestore/courses/python.json
firebase-content/course-content/python/{version}/course.json
firebase-content/course-content/python/{version}/module-*.json
```

The version comes exclusively from the Firestore metadata artifact. Publishing `v2` therefore requires generating a `v2` folder and changing the metadata version; publisher source code does not change.

## Pipeline guarantees

Before connecting to Firebase, the CLI verifies:

- required metadata fields and publication state;
- version and Storage path conventions;
- manifest and module filenames;
- the complete merged Learning Engine schema;
- course identity, module count, and lesson count;
- every local upload file and byte size.

It uploads module files first and `course.json` last, then writes the Firestore metadata document. Finally, it verifies that every Storage object exists with the expected byte size and that Firestore contains the published metadata version and fields. The command exits nonzero on any failure and prints a structured stage summary.

Storage cannot atomically replace several objects. Publish new content under a new version folder before updating metadata; this keeps the currently published version intact if an upload is interrupted.

## Runtime fallback

`VITE_ENABLE_LOCAL_COURSE_FALLBACK` defaults to `false`. Production builds always disable local fallback. To explicitly test fallback during local development, set it to `true`; Firebase-only verification should leave it false.
