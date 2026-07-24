import { sql } from './db';

interface LogAuditParams {
  adminId: string;
  adminName: string;
  adminRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
}

// Best-effort — recording an audit entry should never fail the action it's
// describing (same convention as push delivery failures).
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await sql`
      insert into audit_log (admin_id, admin_name, admin_role, action, target_type, target_id, target_label)
      values (
        ${params.adminId},
        ${params.adminName},
        ${params.adminRole},
        ${params.action},
        ${params.targetType ?? null},
        ${params.targetId ?? null},
        ${params.targetLabel ?? null}
      )
    `;
  } catch {
    // best-effort
  }
}
