import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

const goto = vi.fn();
vi.mock('$app/navigation', () => ({ goto: (...args) => goto(...args) }));

import CardPage from './+page.svelte';

const card = (overrides = {}) => ({
	id: 'abc',
	name: 'Clipper Card',
	image: 'img-123',
	date_acquired: 'March 5, 2021',
	notes: '<p>Some <strong>notes</strong></p>',
	issuing_agency: { name: 'MTC', city: 'San Francisco' },
	...overrides
});

function setHistoryLength(length) {
	Object.defineProperty(window.history, 'length', { configurable: true, value: length });
}

describe('card detail page', () => {
	beforeEach(() => {
		goto.mockReset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('shows the name, agency and location', () => {
		render(CardPage, { data: { transit_card: card() } });
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Clipper Card');
		expect(screen.getByText('MTC')).toBeInTheDocument();
		expect(screen.getByText('San Francisco')).toBeInTheDocument();
	});

	it('renders the card image from the CMS with an alt text', () => {
		render(CardPage, { data: { transit_card: card() } });
		const img = screen.getByAltText('Clipper Card');
		expect(img).toHaveAttribute(
			'src',
			'https://cms.alexwang.net/assets/img-123?format=webp&width=800'
		);
		expect(img).toHaveAttribute('loading', 'lazy');
	});

	it('shows the acquisition date when present', () => {
		render(CardPage, { data: { transit_card: card() } });
		expect(screen.getByText('ACQUISITION DATE')).toBeInTheDocument();
		expect(screen.getByText('March 5, 2021')).toBeInTheDocument();
	});

	it('hides the acquisition date section when absent', () => {
		render(CardPage, { data: { transit_card: card({ date_acquired: null }) } });
		expect(screen.queryByText('ACQUISITION DATE')).toBeNull();
	});

	it('renders notes as HTML', () => {
		render(CardPage, { data: { transit_card: card() } });
		expect(screen.getByText('ADDITIONAL NOTES')).toBeInTheDocument();
		expect(screen.getByText('notes').tagName).toBe('STRONG');
	});

	it('hides the notes section when there are none', () => {
		render(CardPage, { data: { transit_card: card({ notes: null }) } });
		expect(screen.queryByText('ADDITIONAL NOTES')).toBeNull();
	});

	it("includes the I'm Feeling Lucky button", () => {
		render(CardPage, { data: { transit_card: card() } });
		expect(screen.getByRole('button', { name: /feeling lucky/i })).toBeInTheDocument();
	});

	describe('Return to Collection', () => {
		it('goes back in history when there is a previous page', async () => {
			setHistoryLength(5);
			const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
			render(CardPage, { data: { transit_card: card() } });
			await fireEvent.click(screen.getByRole('button', { name: /return to collection/i }));
			expect(back).toHaveBeenCalledTimes(1);
			expect(goto).not.toHaveBeenCalled();
		});

		it('goes home when the card was opened directly (short history)', async () => {
			setHistoryLength(2);
			const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
			render(CardPage, { data: { transit_card: card() } });
			await fireEvent.click(screen.getByRole('button', { name: /return to collection/i }));
			expect(goto).toHaveBeenCalledWith('/');
			expect(back).not.toHaveBeenCalled();
		});
	});
});
