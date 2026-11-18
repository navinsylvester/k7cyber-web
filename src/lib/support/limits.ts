/* Size limits the server checks and the browser checks first, so a refused file never costs the agent the email they wrote. */

/** Files on one email from the case sheet. */
export const EMAIL_FILES_MAX = 10
/** All attachments on one email together: well under Exchange's send limit once encoded, and under the server action's body
   limit (`next.config.ts`, 16 MB) with the message around it. Dynamics itself takes 25 MB a file on UAT. */
export const EMAIL_TOTAL_MAX = 15 * 1024 * 1024
