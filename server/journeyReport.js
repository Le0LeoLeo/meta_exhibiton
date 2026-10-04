// Operator-only report: run inside the app container. No public reporting endpoint.
import { db } from './db.js';
import { createJourneyAnalytics } from './services/journeyAnalytics.js';
try { console.log(JSON.stringify(await createJourneyAnalytics(db).report(), null, 2)); }
finally { db.close(); }
