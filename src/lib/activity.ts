
import { supabase } from "@/integrations/supabase/client";
import type { Db } from "@/lib/db";

export type ActivityType = 
  | 'project_created' 
  | 'project_updated'
  | 'project_deleted'
  | 'project_status_changed' 
  | 'project_deadline_changed'
  | 'project_next_action_changed'
  | 'task_created'
  | 'task_completed'
  | 'task_reopened'
  | 'task_assigned'
  | 'event_created'
  | 'event_completed'
  | 'note_created'
  | 'note_edited'
  | 'contact_linked'
  | 'contact_unlinked'
  | 'transaction_created'
  | 'transaction_paid'
  | 'idea_converted'
  | 'file_uploaded'
  | 'file_deleted';

export async function logActivity(params: {
  projectId: string;
  type: ActivityType;
  description: string;
  entityType: string;
  entityId: string;
  details?: any;
  /** No servidor (assistente): cliente e usuário vindos do middleware. */
  db?: Db;
  userId?: string;
}) {
  const db = params.db ?? supabase;
  let userId = params.userId;
  if (!userId) {
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return;
    userId = userData.user.id;
  }

  await db.from('activity_history').insert({
    user_id: userId,
    project_id: params.projectId,
    action: params.type,
    entity_type: params.entityType,
    entity_id: params.entityId,
    description: params.description,
    details: params.details || {}
  } as any);
}
