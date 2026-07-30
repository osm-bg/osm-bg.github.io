<script>
	import favicon from '$lib/assets/favicon.svg';
	import "$lib/custom.scss";
	import "bootstrap/dist/css/bootstrap.min.css";
	// import "bootstrap/dist/js/bootstrap.bundle.min.js";
	import { onMount } from 'svelte';

	onMount(async () => {
		await import('bootstrap/dist/js/bootstrap.bundle.min.js');
	});


	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="navbar navbar-expand-lg navbar-light bg-light">
	<div class="container-fluid">
		<a class="navbar-brand" href="/">OpenStreetMap България</a>
		<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
			<span class="navbar-toggler-icon"></span>
		</button>
		<div class="collapse navbar-collapse" id="navbarNav">
			<ul class="navbar-nav">
				<li class="nav-item">
					<a class="nav-link" href="/">Начало</a>
				</li>
				<li class="nav-item dropdown">
					<a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
						Инструменти
					</a>
					<ul class="dropdown-menu">
						<li><a class="dropdown-item" href="/qa/atp-osm/">ATP &lt;=&gt; OSM</a></li>
						<li><a class="dropdown-item" href="/qa/motorway-milestones/">Километрични маркери</a></li>
						<li><a class="dropdown-item" href="/qa/road-network/">Пътна мрежа</a></li>
						<li><a class="dropdown-item" href="/qa/railway-network/">Железопътна мрежа</a></li>
						<li><a class="dropdown-item" href="/qa/river-network/">Речна мрежа</a></li>
						<li><a class="dropdown-item" href="/qa/waste-containers/">Контейнери</a></li>
					</ul>
				</li>
			</ul>
		</div>
	</div>
</nav>

<main class="container mt-3">
	{@render children()}
</main>
