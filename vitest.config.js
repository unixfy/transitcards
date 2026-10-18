import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	test: {
		coverage: {
			provider: 'v8',
			include: ['src/**/*.{js,svelte}'],
			exclude: ['src/**/*.test.js'],
			reporter: ['text', 'html']
		},
		projects: [
			{
				extends: true,
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.test.js'],
					exclude: ['src/**/*.svelte.test.js']
				}
			},
			{
				extends: true,
				test: {
					name: 'client',
					environment: 'jsdom',
					include: ['src/**/*.svelte.test.js'],
					setupFiles: ['./vitest-setup.js']
				}
			}
		]
	}
});
