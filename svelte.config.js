import adapter from '@sveltejs/adapter-cloudflare';

// Polling for new deploys lets the installed app offer to update (see src/lib/PwaStatus.svelte)
const config = { kit: { adapter: adapter(), version: { pollInterval: 15 * 60 * 1000 } } };

export default config;
