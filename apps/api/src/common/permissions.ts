/**
 * The permission table now lives in @fh/shared, because the web client needs it
 * too - it decides which controls to render. Keeping a second copy here would
 * guarantee drift, always in the direction of a button that appears and then
 * fails on submit.
 *
 * This file remains as the API's import point so nothing else has to change.
 */
export { Permission, roleHasPermission, permissionsForRole } from '@fh/shared';