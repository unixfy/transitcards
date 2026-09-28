<script>
    import '../app.css';
    import { fade } from 'svelte/transition';
    import { page } from '$app/stores';

    let { children } = $props();
</script>

<svelte:head>
    {#if $page.data.title}
        <title>{$page.data.title} | Alex's Transit Cards</title>
    {:else}
        <title>Alex's Transit Cards</title>
    {/if}
    <title>Alex's Transit Cards</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
</svelte:head>

{#key $page.url.pathname}
    <div in:fade={{ duration: 300 }}> 
        {@render children()}
    </div>
{/key}
