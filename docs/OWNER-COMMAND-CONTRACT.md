# WDESK Owner Command Center — implementation contract

Branch: `feat/full-owner-control-center`
Environment inspected: Supabase project `nuijzdqnhjzcnqpfqvvl` (Aéro Service TEST only).
Production Aéro Service is out of scope and must never be targeted by this feature.

## Security invariants

- The only principal allowed to execute owner commands is the verified `wdesk_control.owner_accounts` row linked to the authenticated Supabase Auth user (`identity_status = 'verified'`).
- Never trust an email, role, owner ID, target table, SQL fragment, or environment supplied by the browser.
- Service-role credentials remain server-side. The browser receives neither privileged keys nor arbitrary SQL capability.
- Every mutation requires a unique request ID, an explicit confirmation phrase for high-impact actions, and a non-empty reason.
- Read the target row before mutation; write an audit event with actor, action, target, before/after snapshots (redacted), reason, request ID, timestamp, and result.
- Prefer reversible status changes and soft-deactivation. Hard deletes and Auth identity deletion are not exposed in the first release.
- Passwords are never readable. Account credential changes must use Supabase Auth password-reset/invite flows.
- A GET request must be strictly read-only. Health-check refreshes and incident upserts belong in an explicit diagnostic POST action.
- The API must be pinned to TEST until a separate environment registration and explicit approval exist.

## Verified application schema (TEST)

| Domain | Tables / verified fields |
|---|---|
| People | `profiles(id, display_name, email, status, public_id, first_name, last_name)` |
| Learners | `students(id, formation_id, group_id, enrollment_date, student_number, education_level)` |
| Staff / teachers | `staff(id, staff_number, department, position, hire_date, status)`; `teachers(id, teacher_number, specialization, hire_date, status)` |
| Training | `formations(id, code, name, description, duration, status)`; `groups(id, formation_id, code, name, academic_year, capacity, status)` |
| Registrations | `registrations(id, registration_number, person_id, formation_id, group_id, registration_date, status, created_by, submitted_at, reviewed_at, reviewed_by, review_comment, created_at)` |
| Attendance | `daily_attendance(id, person_id, local_date, person_type, nominal_time, cutoff_time, arrived_at, status, minutes_after_cutoff, checkpoint_id, latitude, longitude, location_accuracy_m, created_at)`; `attendance_events(id, attendance_id, person_id, event_type, occurred_at, source, metadata, created_by)` |
| Courses | `course_sessions(id, formation_id, group_id, session_date, planned_start, planned_end, status, subject)` |
| Penalties | `penalty_rules(id, person_type, penalty_type, description, target_scope, application_mode, applies_after_time, min_delay_minutes, max_delay_minutes, tolerance_minutes, amount_fcfa, blocks_access, priority, active, effective_from, effective_until, created_by, created_at, formation_id)`; `penalties(id, person_id, amount_fcfa, status, created_at, penalty_type, description, rule_id, daily_attendance_id)` |
| Payments | `payments(id, penalty_id, person_id, amount_fcfa, method, provider, transaction_reference, status, received_at, received_by, validated_at, validated_by, refusal_reason, receipt_number, created_at, updated_at, payment_type, payment_category, payer_name, payer_phone, payer_identifier, payment_description)` |

The schema must be re-read before each migration or write; this map is a discovery snapshot, not a license to assume that unlisted fields or constraints exist.

## Command rollout order

1. Read-only inventory: profiles, learners, staff, formations, groups, registrations, attendance, penalties, payments, devices, and schedules.
2. Reversible low-risk mutations: profile contact/name edits, active/inactive status, learner formation/group assignment, formation/group status, schedule/session suspension.
3. Attendance corrections: explicit before/after values, reason, source marker, and append-only attendance event.
4. Finance: rule changes and penalty/payment corrections only with linked IDs and a full before/after audit; never create a penalty payment without a valid `penalty_id`.
5. Account lifecycle: invite and password-reset only; no password retrieval, no silent deletion, no impersonation.
6. Device/GPS controls: narrowly scoped, expiring overrides with automatic expiry and audit trail.

## Current backend limitation

The existing `wdesk-control-api` Edge Function v6 supports owner bootstrap and a GET dashboard/diagnostic path. It does not yet implement the command registry above. Its GET currently writes health-check and incident records, so it must be made read-only before being used as a general query endpoint. Do not present any mutation controls as operational until the server-side action exists and is tested.
