# FastScript Incident Playbook

## Rollback
1. Keep previous `dist/` artifact.
2. Stop current process.
3. Start previous artifact with `fastscript start`.

## Session Key Rotation
1. Set new `SESSION_SECRET`.
2. Restart app.
3. Existing sessions are invalidated.

## Backup
- Back up `.fastscript/` database and job files every hour.

## Verification
- Run `npm run smoke:start`.
- Check logs for `request_error` and high 5xx rate.
