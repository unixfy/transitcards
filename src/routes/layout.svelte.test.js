import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { writable } from 'svelte/store';

const pageStore = writable({});
vi.mock('$app/stores', () => ({ page: { subscribe: (...a) => pageStore.subscribe(...a) } }));

import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({
	render: () => '<p data-testid="child">child content</p>'
}));

function setPage(data = {}, pathname = '/') {
	pageStore.set({ data, url: new URL(`http://localhost${pathname}`) });
}

describe('root layout', () => {
	beforeEach(() => {
		setPage();
		document.title = '';
	});

	it('renders the site header with the total card count and the page content', () => {
		render(Layout, { data: { totalAllCards: 123 }, children });
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Alex's Transit Cards");
		expect(screen.getByText('123 total cards')).toBeInTheDocument();
		expect(screen.getByTestId('child')).toBeInTheDocument();
	});

	it('uses a page-specific <title> when the page provides one', () => {
		setPage({ title: 'Home' });
		render(Layout, { data: { totalAllCards: 1 }, children });
		expect(document.title).toBe("Home | Alex's Transit Cards");
	});

	it('falls back to the default <title>', () => {
		render(Layout, { data: { totalAllCards: 1 }, children });
		expect(document.title).toBe("Alex's Transit Cards");
	});

	it('links the favicon', () => {
		render(Layout, { data: { totalAllCards: 1 }, children });
		const icon = document.head.querySelector('link[rel="icon"]');
		expect(icon).toHaveAttribute('href', '/favicon.svg');
		expect(icon).toHaveAttribute('type', 'image/svg+xml');
	});

	it('renders chromeless pages without the header', () => {
		setPage({ chromeless: true, title: 'Slideshow' });
		render(Layout, { data: { totalAllCards: 5 }, children });
		expect(screen.getByTestId('child')).toBeInTheDocument();
		expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
		expect(screen.queryByText('5 total cards')).toBeNull();
		expect(document.title).toBe("Slideshow | Alex's Transit Cards");
	});
});
