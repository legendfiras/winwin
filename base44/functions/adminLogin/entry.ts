import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readBody, json, db, createAdminSession } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const password = String(body.password || '');
    const settings = await database.entities.AppSettings.list();
    const row = settings.find((s: any) => s.setting_key === 'admin_password');
    const adminPass = row?.setting_value || '1234';
    if (!password || password !== adminPass) {
      return json({ error: 'Incorrect password' }, 401);
    }
    const { token, session } = await createAdminSession(database);
    return json({ success: true, admin_session_token: token, admin_session_id: session.id });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
