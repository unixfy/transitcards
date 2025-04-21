<script>
    import '../app.css';
    import { fade } from 'svelte/transition'; // Import the fade transition
    import { page } from '$app/stores'; // Import the page store

    let { children } = $props();
</script>

<div class="navbar bg-base-100 shadow-md">
    <div class="flex-1">
        <a href="/" class="btn btn-ghost text-xl">Alex's Transit Cards</a>
    </div>
    <div class="flex-none">
        <ul class="menu menu-horizontal px-1">
            <li><a href="/">Home</a></li>
            <li><a href="https://cms.alexwang.net/auth/login/keycloak?redirect=https%3A%2F%2Fcms.alexwang.net%2Fadmin%2Flogin%3Fcontinue%3D">Sign In</a></li>
        </ul>
    </div>
</div>

{#key $page.url.pathname}
    <div in:fade={{ duration: 300 }}> 
        {@render children()}
    </div>
{/key}
