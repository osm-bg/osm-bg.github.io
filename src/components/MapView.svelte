<script>
	import "leaflet/dist/leaflet.css";
	import { onMount } from "svelte";
	import L from "leaflet";
	import { LocateControl } from "leaflet.locatecontrol";
	import '/node_modules/leaflet.locatecontrol/dist/L.Control.Locate.min.css';
	let map;
	export let startZoom = 7;
	export let minZoom = 7;
	export let maxZoom = 18;
	export let height = "400px";
	export let enableLocateControl = true;
	export let center = [42.740, 25.450];

	onMount(async () => {
		map = L.map('map').setView(center, startZoom);

		L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			minZoom: minZoom,
			maxZoom: maxZoom,
			maxNativeZoom: 19,
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(map);

		if (enableLocateControl) {
			new LocateControl().addTo(map);
		}

		map.invalidateSize();
	});

	export function get_map() {
		return map;
	}
</script>

<style>
	#map {
		width: 100%;
		height: var(--map-height);
	}
</style>

<div id="map" style="--map-height: {height};"></div>