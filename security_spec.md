# Security Specification - Gestión de Cometidos Hospital de Curepto

## Data Invariants
1. A **Cometido** MUST belong to a valid user profile.
2. Only the owner (funcionario) can create or update their own cometidos when they are in 'Borrador' or 'Devuelto' state.
3. Once submitted, the owner cannot modify the core fields of a cometido (motivo, destino, fechas).
4. **Roles and Permissions**:
   - **Funcionario**: Can create and read own cometidos.
   - **Jefatura**: Can read cometidos from their service and update status between 'Pendiente revisión jefatura' and 'Aprobado'/'Rechazado'/'Devuelto'.
   - **Director**: Can authorize cometidos approved by jefatura.
   - **Personal**: Can process authorized cometidos.
   - **Finanzas**: Can process payments for authorized cometidos.
   - **Administrador**: Full read/write for maintenance.
5. Users cannot change their own roles or the serviceId once set (unless they are Admin).

## The Dirty Dozen Payloads (Identity & Integrity Attacks)

1. **Self-Promotion**: Authenticated user trying to create a profile with `rol: 'Administrador'`.
2. **Identity Spoofing (Create)**: User A trying to create a Cometido with `funcionarioUid: 'UserB'`.
3. **Identity Spoofing (Update)**: User A trying to update User B's Cometido.
4. **State Jumping**: Funcionario trying to update a Cometido from 'Pendiente revisión jefatura' to 'Pagado' directly.
5. **Role Escalation**: Regular user trying to update their own profile to change their role.
6. **Service Poisoning**: User belonging to 'Urgencias' trying to authorize a cometido from 'Finanzas'.
7. **Ghost Field Injection**: Adding a field `__sys_admin__: true` to a document.
8. **Resource Exhaustion**: Sending a 1MB string as the `motivo`.
9. **Relational Sync Bypass**: Creating a Cometido for a `servicioId` that does not exist.
10. **ID Poisoning**: Using a path variable containing special characters as a document ID.
11. **PII Leakage**: A user trying to list all users' emails/RUTs without being Admin or Personal role.
12. **Terminal State Edit**: Trying to update a 'Pagado' or 'Finalizado' cometido.

## The Test Runner (firestore.rules.test.ts)
(To be implemented if requested or after rules are drafted)
