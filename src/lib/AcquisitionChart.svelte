<script>
	/**
	 * Expandable, interactive graph of cards in the collection, cumulative over time.
	 *
	 * `counts` is a list of { date: [year, month, day] | null, count } groups for the current
	 * filtered set, with date parts from Directus' date functions. Cards without a date
	 * (date: null) are assumed to have been acquired on `earliest`, the earliest acquisition date
	 * across the whole collection.
	 */
	import { scaleLinear, scaleTime } from 'd3-scale';
	import { area, curveStepAfter, line } from 'd3-shape';
	import { timeDay, timeMonth } from 'd3-time';
	import { ascending, bisector, cumsum, greatest, least, leastIndex, rollups, sum } from 'd3-array';

	let { counts = [], earliest = null } = $props();

	const HEIGHT = 260;
	const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
	const RANGES = [
		{ label: 'All', months: null },
		{ label: '1Y', months: 12 },
		{ label: '6M', months: 6 },
		{ label: '3M', months: 3 }
	];
	const toDate = ([year, month, day]) => new Date(year, month - 1, day);
	const formatDate = (date) =>
		date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

	let open = $state(false);
	let rangeMonths = $state(null);
	let width = $state(0);
	let hoverIndex = $state(null);

	const totalCount = $derived(sum(counts, (c) => c.count));
	const undatedCount = $derived(sum(counts, (c) => (c.date ? 0 : c.count)));
	// First/latest stats only consider cards with a real acquired date
	const firstDated = $derived(least(counts, (c) => (c.date ? +toDate(c.date) : undefined)));
	const latestDated = $derived(greatest(counts, (c) => (c.date ? +toDate(c.date) : undefined)));

	// Cumulative series: one point per acquisition date, sorted ascending
	const points = $derived.by(() => {
		const groups = rollups(
			counts.filter((c) => c.date ?? earliest),
			(v) => sum(v, (c) => c.count),
			(c) => +toDate(c.date ?? earliest)
		).sort(([a], [b]) => ascending(a, b));
		const totals = cumsum(groups, ([, added]) => added);
		return groups.map(([date, added], i) => ({
			date: new Date(date),
			added,
			cumulative: totals[i]
		}));
	});

	// Points in the selected range; a range that starts mid-series gets a point carrying the running total
	const visible = $derived.by(() => {
		const rangeStart = rangeMonths && timeMonth.offset(timeDay.floor(new Date()), -rangeMonths);
		if (!points.length || !rangeStart || rangeStart <= points[0].date) return points;
		const i = bisector((p) => p.date).right(points, rangeStart);
		const startPoint = {
			date: rangeStart,
			cumulative: points[i - 1].cumulative,
			isRangeStart: true
		};
		return [startPoint, ...points.slice(i)];
	});

	const x = $derived.by(() => {
		let start = visible[0]?.date ?? new Date();
		let end = new Date(Math.max(timeDay.floor(new Date()), visible.at(-1)?.date ?? 0));
		// Pad very short spans so a single date doesn't collapse the axis
		if (timeDay.count(start, end) < 14)
			[start, end] = [timeDay.offset(start, -7), timeDay.offset(end, 7)];
		return scaleTime()
			.domain([start, end])
			.range([PAD.left, width - PAD.right]);
	});

	// The y-axis starts at 0 for all time, and zooms in to the visible change for shorter ranges
	const y = $derived.by(() => {
		const max = visible.at(-1)?.cumulative ?? 0;
		const min = rangeMonths && visible[0]?.cumulative < max ? visible[0].cumulative : 0;
		return scaleLinear()
			.domain([min, Math.max(max, min + 1)])
			.range([HEIGHT - PAD.bottom, PAD.top])
			.nice(4);
	});

	// The line steps up on each acquisition date, then holds flat until the end of the axis
	const series = $derived(
		visible.length
			? [...visible, { date: x.domain()[1], cumulative: visible.at(-1).cumulative }]
			: []
	);
	const linePath = $derived(
		line()
			.x((p) => x(p.date))
			.y((p) => y(p.cumulative))
			.curve(curveStepAfter)(series)
	);
	const areaPath = $derived(
		area()
			.x((p) => x(p.date))
			.y0(y.range()[0])
			.y1((p) => y(p.cumulative))
			.curve(curveStepAfter)(series)
	);

	const hovered = $derived(hoverIndex !== null ? visible[hoverIndex] : null);

	function handlePointerMove(event) {
		const px = event.clientX - event.currentTarget.getBoundingClientRect().left;
		// Snap to the nearest acquisition date
		hoverIndex = leastIndex(visible, (p) => Math.abs(x(p.date) - px)) ?? null;
	}
</script>

<div class="collapse-arrow bg-base-100 border-base-content/15 collapse border">
	<input type="checkbox" bind:checked={open} aria-label="Toggle collection growth graph" />
	<div class="collapse-title text-base-content flex flex-wrap items-center gap-3">
		Cards Over Time
		<span class="badge badge-outline">
			{totalCount} card{totalCount === 1 ? '' : 's'}
		</span>
	</div>
	<div class="collapse-content">
		{#if points.length === 0}
			<p class="text-base-content/80 py-6 text-center">No cards to graph.</p>
		{:else}
			<div class="flex flex-col gap-4">
				<div class="stats stats-vertical sm:stats-horizontal bg-base-200 w-full">
					<div class="stat">
						<div class="stat-title text-base-content/80 text-sm">Cards</div>
						<div class="stat-value font-display text-(--brand)">{totalCount}</div>
						<div class="stat-desc text-base-content/80">
							{undatedCount} without an acquisition date
						</div>
					</div>
					<div class="stat">
						<div class="stat-title text-base-content/80 text-sm">First acquired card</div>
						<div class="stat-value font-display tnum text-2xl">
							{firstDated ? formatDate(toDate(firstDated.date)) : '—'}
						</div>
					</div>
					<div class="stat">
						<div class="stat-title text-base-content/80 text-sm">Latest acquired card</div>
						{#if latestDated}
							<div class="stat-value font-display tnum text-2xl">
								{formatDate(toDate(latestDated.date))}
							</div>
							<div class="stat-desc text-base-content/80">
								+{latestDated.count} card{latestDated.count === 1 ? '' : 's'}
							</div>
						{:else}
							<div class="stat-value font-display tnum text-2xl">—</div>
						{/if}
					</div>
				</div>

				<div class="flex justify-end">
					<div class="join" role="group" aria-label="Time range">
						{#each RANGES as range (range.label)}
							<button
								type="button"
								class="join-item btn btn-sm {rangeMonths === range.months ? 'btn-primary' : ''}"
								aria-pressed={rangeMonths === range.months}
								onclick={() => {
									rangeMonths = range.months;
									hoverIndex = null;
								}}>{range.label}</button
							>
						{/each}
					</div>
				</div>

				<div class="relative w-full" style="height: {HEIGHT}px" bind:clientWidth={width}>
					{#if width > 0}
						<svg
							{width}
							height={HEIGHT}
							class="block touch-pan-y select-none"
							role="img"
							aria-label="Cumulative number of cards over time"
							onpointermove={handlePointerMove}
							onpointerdown={handlePointerMove}
							onpointerleave={() => (hoverIndex = null)}
							onpointercancel={() => (hoverIndex = null)}
						>
							<!-- Gridlines and y-axis labels -->
							{#each y.ticks(4).filter(Number.isInteger) as tick (tick)}
								<line
									x1={PAD.left}
									x2={width - PAD.right}
									y1={y(tick)}
									y2={y(tick)}
									class="stroke-base-content/10"
								/>
								<text
									x={PAD.left - 8}
									y={y(tick)}
									text-anchor="end"
									dominant-baseline="middle"
									class="fill-base-content/80 text-[11px]">{tick}</text
								>
							{/each}

							<!-- stations along the route: one per x-axis tick -->
							{#each x.ticks(Math.max(2, Math.floor((width - PAD.left - PAD.right) / 70))) as tick, i (+tick)}
								<circle
									cx={x(tick)}
									cy={HEIGHT - PAD.bottom}
									r="5"
									class="fill-base-100"
									stroke={['#1f9d6b', '#2f7fe0', '#f08a24', '#e0457b', '#8a5cf0'][i % 5]}
									stroke-width="3"
								/>
							{/each}

							<!-- x-axis labels -->
							{#each x.ticks(Math.max(2, Math.floor((width - PAD.left - PAD.right) / 70))) as tick (+tick)}
								<text
									x={x(tick)}
									y={HEIGHT - 8}
									text-anchor="middle"
									class="fill-base-content/80 text-[11px]">{x.tickFormat()(tick)}</text
								>
							{/each}

							<defs>
								<linearGradient id="route-gradient" x1="0" x2="1" y1="0" y2="0">
									<stop offset="0%" stop-color="#1f9d6b" />
									<stop offset="28%" stop-color="#2f7fe0" />
									<stop offset="56%" stop-color="#f08a24" />
									<stop offset="80%" stop-color="#e0457b" />
									<stop offset="100%" stop-color="#8a5cf0" />
								</linearGradient>
								<linearGradient id="route-fill" x1="0" x2="1" y1="0" y2="0">
									<stop offset="0%" stop-color="#1f9d6b" stop-opacity="0.2" />
									<stop offset="56%" stop-color="#f08a24" stop-opacity="0.16" />
									<stop offset="100%" stop-color="#8a5cf0" stop-opacity="0.2" />
								</linearGradient>
							</defs>
							<path d={areaPath} fill="url(#route-fill)" />
							<path
								d={linePath}
								fill="none"
								stroke="url(#route-gradient)"
								stroke-width="4"
								stroke-linejoin="round"
								stroke-linecap="round"
							/>

							{#if hovered}
								<line
									x1={x(hovered.date)}
									x2={x(hovered.date)}
									y1={PAD.top}
									y2={HEIGHT - PAD.bottom}
									class="stroke-base-content/40"
									stroke-dasharray="4 4"
								/>
								<circle
									cx={x(hovered.date)}
									cy={y(hovered.cumulative)}
									r="5"
									class="stroke-base-100 fill-(--brand)"
									stroke-width="2"
								/>
							{/if}
						</svg>

						{#if hovered}
							<div
								class="bg-neutral text-neutral-content rounded-box pointer-events-none absolute z-10 px-3 py-2 text-sm whitespace-nowrap shadow-xl"
								style="left: {Math.min(Math.max(x(hovered.date), 70), width - 70)}px; top: {y(
									hovered.cumulative
								) > 90
									? y(hovered.cumulative) - 80
									: y(hovered.cumulative) + 14}px; transform: translateX(-50%)"
							>
								<div class="text-neutral-content/80">{formatDate(hovered.date)}</div>
								<div class="text-primary text-sm font-bold">
									{hovered.cumulative} card{hovered.cumulative === 1 ? '' : 's'}
								</div>
								{#if !hovered.isRangeStart}
									<div class="text-neutral-content/80">+{hovered.added} acquired</div>
								{/if}
							</div>
						{/if}
					{/if}
				</div>

				{#if undatedCount > 0 && earliest}
					<p class="text-base-content/80 text-sm">
						* {undatedCount} card{undatedCount === 1 ? '' : 's'} without an acquisition date
						{undatedCount === 1 ? 'is' : 'are'} counted as acquired on {formatDate(
							toDate(earliest)
						)}, the earliest date in the collection.
					</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
