import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

const goto = vi.fn();
vi.mock('$app/navigation', () => ({ goto: (...args) => goto(...args) }));

import ImFeelingLuckyButton from './ImFeelingLuckyButton.svelte';

describe('ImFeelingLuckyButton', () => {
	beforeEach(() => {
		goto.mockReset();
	});

	it('renders a button with a helpful title', () => {
		render(ImFeelingLuckyButton);
		const button = screen.getByRole('button', { name: /feeling lucky/i });
		expect(button).toHaveAttribute('title', 'Click to view a random card from the collection');
	});

	it('navigates to /feeling-lucky without adding a history entry', async () => {
		render(ImFeelingLuckyButton);
		await fireEvent.click(screen.getByRole('button'));
		expect(goto).toHaveBeenCalledTimes(1);
		expect(goto).toHaveBeenCalledWith('/feeling-lucky', { replaceState: true });
	});

	it('does not navigate until clicked', () => {
		render(ImFeelingLuckyButton);
		expect(goto).not.toHaveBeenCalled();
	});
});
