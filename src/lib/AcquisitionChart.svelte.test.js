import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import AcquisitionChart from './AcquisitionChart.svelte';

// "Today" for range maths
const NOW = new Date(2024, 5, 15, 12); // 15 June 2024

const fmt = ([y, m, d]) =>
	new Date(y, m - 1, d).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});

const COUNTS = [
	{ date: [2022, 1, 10], count: 3 },
	{ date: [2023, 6, 1], count: 2 },
	{ date: [2024, 5, 20], count: 5 },
	{ date: null, count: 4 }
];
const EARLIEST = [2022, 1, 10];

async function pointer(el, type, clientX) {
	await fireEvent(el, new MouseEvent(type, { clientX, bubbles: true }));
}

describe('AcquisitionChart', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(NOW);
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	describe('empty state', () => {
		it('shows a placeholder when there are no counts', () => {
			render(AcquisitionChart);
			expect(screen.getByText('No cards to graph.')).toBeInTheDocument();
			expect(screen.queryByRole('img')).not.toBeInTheDocument();
		});

		it('shows a placeholder when only undated cards exist and there is no earliest date', () => {
			render(AcquisitionChart, { counts: [{ date: null, count: 3 }], earliest: null });
			expect(screen.getByText('No cards to graph.')).toBeInTheDocument();
			// The title still counts them
			expect(screen.getByText('3 cards')).toBeInTheDocument();
		});

		it('pluralizes the badge for zero cards', () => {
			render(AcquisitionChart, { counts: [] });
			expect(screen.getByText('0 cards')).toBeInTheDocument();
		});
	});

	describe('header and stats', () => {
		it('renders the title, toggle and total count', () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			expect(screen.getByText(/Cards Over Time/)).toBeInTheDocument();
			expect(screen.getByText('14 cards')).toBeInTheDocument();
			expect(
				screen.getByRole('checkbox', { name: 'Toggle collection growth graph' })
			).not.toBeChecked();
		});

		it('uses the singular for a single card', () => {
			render(AcquisitionChart, { counts: [{ date: [2024, 1, 1], count: 1 }], earliest: null });
			expect(screen.getByText('1 card')).toBeInTheDocument();
		});

		it('toggles the checkbox', async () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			const box = screen.getByRole('checkbox');
			await fireEvent.click(box);
			expect(box).toBeChecked();
		});

		it('shows the undated count and first/latest acquired dates', () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			expect(screen.getByText('4 without an acquisition date')).toBeInTheDocument();
			expect(screen.getByText(fmt([2022, 1, 10]))).toBeInTheDocument();
			expect(screen.getByText(fmt([2024, 5, 20]))).toBeInTheDocument();
			expect(screen.getByText('+5 cards')).toBeInTheDocument();
		});

		it('uses the singular for a latest day with one card', () => {
			render(AcquisitionChart, { counts: [{ date: [2024, 2, 2], count: 1 }], earliest: null });
			expect(screen.getByText('+1 card')).toBeInTheDocument();
		});

		it('shows dashes when no card has a date', () => {
			render(AcquisitionChart, {
				counts: [{ date: null, count: 2 }],
				earliest: [2020, 1, 1]
			});
			expect(screen.getAllByText('—')).toHaveLength(2);
		});

		it('footnotes undated cards with the earliest date (plural)', () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			const note = screen.getByText(/without an acquisition date are counted as acquired on/);
			expect(note).toHaveTextContent(`* 4 cards without an acquisition date are counted`);
			expect(note).toHaveTextContent(fmt(EARLIEST));
		});

		it('footnotes a single undated card in the singular', () => {
			render(AcquisitionChart, {
				counts: [
					{ date: [2022, 1, 10], count: 1 },
					{ date: null, count: 1 }
				],
				earliest: EARLIEST
			});
			expect(screen.getByText(/1 card without an acquisition date is counted/)).toBeInTheDocument();
		});

		it('omits the footnote when every card is dated', () => {
			render(AcquisitionChart, {
				counts: [{ date: [2022, 1, 10], count: 2 }],
				earliest: EARLIEST
			});
			expect(screen.queryByText(/is counted as acquired on|are counted as acquired on/)).toBeNull();
		});

		it('omits the footnote when there is no earliest date', () => {
			render(AcquisitionChart, {
				counts: [
					{ date: [2022, 1, 10], count: 2 },
					{ date: null, count: 2 }
				],
				earliest: null
			});
			expect(screen.queryByText(/counted as acquired on/)).toBeNull();
		});
	});

	describe('graph', () => {
		it('renders the svg with area and line paths', () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			const svg = screen.getByRole('img', { name: 'Cumulative number of cards over time' });
			expect(svg).toHaveAttribute('width', '600');
			expect(svg).toHaveAttribute('height', '260');
			const paths = svg.querySelectorAll('path');
			expect(paths).toHaveLength(2);
			for (const p of paths) expect(p.getAttribute('d')).toMatch(/^M/);
		});

		it('draws integer y-axis labels', () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			const svg = screen.getByRole('img');
			const labels = [...svg.querySelectorAll('text[text-anchor="end"]')].map((t) => t.textContent);
			expect(labels.length).toBeGreaterThan(1);
			for (const label of labels) expect(Number.isInteger(Number(label))).toBe(true);
		});

		it('draws x-axis labels', () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			const svg = screen.getByRole('img');
			expect(svg.querySelectorAll('text[text-anchor="middle"]').length).toBeGreaterThan(0);
		});

		it('handles a single date by padding the axis', () => {
			render(AcquisitionChart, {
				counts: [{ date: [2024, 6, 15], count: 1 }],
				earliest: null
			});
			expect(screen.getByRole('img')).toBeInTheDocument();
		});

		it('merges undated cards into the earliest date', () => {
			render(AcquisitionChart, {
				counts: [
					{ date: [2022, 1, 10], count: 1 },
					{ date: null, count: 2 }
				],
				earliest: EARLIEST
			});
			// Same-day groups collapse into one point, so hovering shows all 3 added
			return hoverFirst().then(() => {
				expect(tooltip()).toHaveTextContent('3 cards');
				expect(tooltip()).toHaveTextContent('+3 acquired');
			});
		});

		it('ignores undated cards when no earliest is known', () => {
			render(AcquisitionChart, {
				counts: [
					{ date: [2022, 1, 10], count: 1 },
					{ date: null, count: 2 }
				],
				earliest: null
			});
			return hoverFirst().then(() => {
				expect(screen.getByText('+1 acquired')).toBeInTheDocument();
			});
		});
	});

	describe('time range selector', () => {
		it('renders All / 1Y / 6M / 3M with All pressed by default', () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			const group = screen.getByRole('group', { name: 'Time range' });
			const buttons = within(group).getAllByRole('button');
			expect(buttons.map((b) => b.textContent)).toEqual(['All', '1Y', '6M', '3M']);
			expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
			expect(screen.getByRole('button', { name: '1Y' })).toHaveAttribute('aria-pressed', 'false');
		});

		it('switches the selected range', async () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			await fireEvent.click(screen.getByRole('button', { name: '6M' }));
			expect(screen.getByRole('button', { name: '6M' })).toHaveAttribute('aria-pressed', 'true');
			expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
		});

		it('starts a mid-series range with the running total (hover shows no "+N acquired")', async () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			await fireEvent.click(screen.getByRole('button', { name: '1Y' }));
			await hoverFirst();
			// Before 15 Jun 2023 there were 3 + 4 (undated => 2022-01-10) + 2 (2023-06-01) = 9 cards
			expect(tooltip()).toHaveTextContent('9 cards');
			expect(tooltip()).not.toHaveTextContent('acquired');
		});

		it('keeps all points when the range starts before the first one', async () => {
			render(AcquisitionChart, {
				counts: [{ date: [2024, 5, 1], count: 2 }],
				earliest: null
			});
			await fireEvent.click(screen.getByRole('button', { name: '1Y' }));
			await hoverFirst();
			expect(screen.getByText('+2 acquired')).toBeInTheDocument();
		});

		it('zooms the y-axis to the visible change on a short range', async () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			await fireEvent.click(screen.getByRole('button', { name: 'All' }));
			const svg = screen.getByRole('img');
			const allLabels = [...svg.querySelectorAll('text[text-anchor="end"]')].map((t) =>
				Number(t.textContent)
			);
			expect(Math.min(...allLabels)).toBe(0);

			await fireEvent.click(screen.getByRole('button', { name: '3M' }));
			const zoomed = [...screen.getByRole('img').querySelectorAll('text[text-anchor="end"]')].map(
				(t) => Number(t.textContent)
			);
			expect(Math.min(...zoomed)).toBeGreaterThan(0);
		});

		it('resets the hover when the range changes', async () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			await hoverFirst();
			expect(document.querySelector('.rounded-box')).not.toBeNull();
			await fireEvent.click(screen.getByRole('button', { name: '3M' }));
			expect(document.querySelector('.rounded-box')).toBeNull();
		});

		it('handles a range that excludes every acquisition (flat line)', async () => {
			render(AcquisitionChart, {
				counts: [{ date: [2010, 1, 1], count: 5 }],
				earliest: null
			});
			await fireEvent.click(screen.getByRole('button', { name: '3M' }));
			await hoverFirst();
			expect(tooltip()).toHaveTextContent('5 cards');
		});
	});

	describe('hover tooltip', () => {
		it('shows a tooltip for the nearest point on pointer move', async () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			expect(document.querySelector('.rounded-box')).toBeNull();
			await pointer(screen.getByRole('img'), 'pointermove', 599);
			const tip = document.querySelector('.rounded-box');
			expect(tip).not.toBeNull();
			// Far right = latest point: 14 cumulative, +5 acquired
			expect(tip).toHaveTextContent('14 cards');
			expect(tip).toHaveTextContent('+5 acquired');
			expect(tip).toHaveTextContent(fmt([2024, 5, 20]));
		});

		it('snaps to the first point on the far left', async () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			await pointer(screen.getByRole('img'), 'pointermove', 0);
			// 3 dated + 4 undated on the earliest day
			expect(document.querySelector('.rounded-box')).toHaveTextContent('7 cards');
		});

		it('responds to pointerdown (touch)', async () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			await pointer(screen.getByRole('img'), 'pointerdown', 599);
			expect(document.querySelector('.rounded-box')).not.toBeNull();
		});

		it('draws a guide line and marker while hovering', async () => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			const svg = screen.getByRole('img');
			expect(svg.querySelector('circle')).toBeNull();
			await pointer(svg, 'pointermove', 300);
			expect(svg.querySelector('circle')).not.toBeNull();
			expect(svg.querySelector('line[stroke-dasharray]')).not.toBeNull();
		});

		it.each(['pointerleave', 'pointercancel'])('hides the tooltip on %s', async (type) => {
			render(AcquisitionChart, { counts: COUNTS, earliest: EARLIEST });
			const svg = screen.getByRole('img');
			await pointer(svg, 'pointermove', 300);
			expect(document.querySelector('.rounded-box')).not.toBeNull();
			await pointer(svg, type, 0);
			expect(document.querySelector('.rounded-box')).toBeNull();
		});

		it('uses the singular in the tooltip for one card', async () => {
			render(AcquisitionChart, {
				counts: [{ date: [2024, 1, 1], count: 1 }],
				earliest: null
			});
			await hoverFirst();
			expect(document.querySelector('.rounded-box')).toHaveTextContent('1 card');
			expect(document.querySelector('.rounded-box')).not.toHaveTextContent('1 cards');
		});
	});
});

const tooltip = () => document.querySelector('.rounded-box');

async function hoverFirst() {
	await pointer(screen.getByRole('img'), 'pointermove', 0);
}
