-- A flagged receipt no longer credits Flagrr Cash immediately — points are
-- held until a course_admin/super_admin actually approves it (rejecting as
-- fraud never awards anything, so there's nothing to claw back). Defaults to
-- true so every already-flagged-and-unresolved receipt (which DID get its
-- points credited at submission under the old immediate-credit behavior) is
-- handled correctly by the code that resolves it — no double-crediting on
-- approval, no missed claw-back on a fraud confirmation.
alter table receipts add column if not exists points_credited boolean not null default true;
