/* Where the app runs. `next start` sets NODE_ENV=production, but the testers' server is a production build on the developer's
   machine behind the tunnel (docs/support-portal/09-portal-guide.md §1): `K7_LOCAL_BUILD=1` in its .env keeps the development
   doors and fallbacks `next dev` has (the probe token as the service identity, the on-screen code, the partner portal switch,
   the mail log). On a real deployment the flag is absent and they are off. Cookie `secure` flags stay on NODE_ENV. */
export const isDeployed = (env: NodeJS.ProcessEnv = process.env): boolean => env.NODE_ENV === 'production' && env.K7_LOCAL_BUILD !== '1'
