import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readBody, json, db, sha256 } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const token = body.session_token;
    if (token) {
      const token_hash = await sha256(token);
      const sessions = await database.entities.CustomerSession.filter({ token_hash });
      if (sessions?.[0]) {
        await database.entities.CustomerSession.delete(sessions[0].id);
      }
    }
    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
