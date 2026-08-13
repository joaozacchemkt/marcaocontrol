
import { supabase } from "@/integrations/supabase/client";

export type ActivityType = 
  | 'project_created' 
  | 'project_status_changed' 
  | 'project_deadline_changed'
  | 'project_next_action_changed'
  | 'task_created' 
  | 'task_completed' 
  | 'task_reopened'
  | 'event_created'
  | 'event_completed'
  | 'note_created'
  | 'note_edited'
  | 'contact_linked'
  | 'contact_unlinked'
  | 'transaction_created'
  | 'transaction_paid'
  | 'idea_converted';

export async function logActivity(params: {
  projectId: string;
  type: ActivityType;
  description: string;
  entityType: string;
  entityId: string;
  details?: any;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase.from('activity_history').insert({
    user_id: userData.user.id,
    project_id: params.projectId,
    action: params.type,
    entity_type: params.entityType,
    entity_id: params.entityId,
    description: params.description,
    details: params.details || {}
  } as any);
}
