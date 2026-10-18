import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

const goto = vi.fn();
vi.mock('$app/navigation', () => ({ goto: (...args) => goto(...args) }));

import ImFeelingLuckyButton from './ImFeelingLuckyButton.svelte';

describe('ImFeelingLuckyButton', () => {
	beforeEach(() => {
		goto.mockReset();
		sessionStorage.clear();
		window.history.replaceState({}, '', '/');
	});

	it('renders a button with a helpful title', () => {
		render(ImFeelingLuckyButton);
		const button = screen.getByRole('button', { name: /feeling lucky/i });
		expect(button).toHaveAttribute('title', 'Click to view a random card from the collection');
	});

	it('navigates to /feeling-lucky without replacing the current history entry', async () => {
		render(ImFeelingLuckyButton);
		await fireEvent.click(screen.getByRole('button'));
		expect(goto).toHaveBeenCalledTimes(1);
		expect(goto).toHaveBeenCalledWith('/feeling-lucky');
	});

	it('does not navigate until clicked', () => {
		render(ImFeelingLuckyButton);
		expect(goto).not.toHaveBeenCalled();
	});

	it('remembers the homepage URL with its query params when clicked there', async () => {
		window.history.replaceState({}, '', '/?page=2&agency=a1');
		render(ImFeelingLuckyButton);
		await fireEvent.click(screen.getByRole('button'));
		expect(sessionStorage.getItem('collectionUrl')).toBe('/?page=2&agency=a1');
	});

	it('remembers nothing when clicked outside the collection without a returnTo', async () => {
		window.history.replaceState({}, '', '/card/abc');
		render(ImFeelingLuckyButton);
		await fireEvent.click(screen.getByRole('button'));
		expect(sessionStorage.getItem('collectionUrl')).toBeNull();
	});

	it('passes along an explicit returnTo (card page chaining random cards)', async () => {
		window.history.replaceState({}, '', '/card/abc');
		render(ImFeelingLuckyButton, { returnTo: '/?search=bart' });
		await fireEvent.click(screen.getByRole('button'));
		expect(sessionStorage.getItem('collectionUrl')).toBe('/?search=bart');
	});
});
