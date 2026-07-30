<script>
    import Title from "/src/components/Title.svelte";
    import MapView from "/src/components/MapView.svelte";
    import RoadNetworkRoadBtn from "/src/components/RoadNetworkRoadBtn.svelte";
    import { onMount } from "svelte";
    import L from 'leaflet';
    import { decode } from 'google-polyline';
    import { SvelteSet } from 'svelte/reactivity';
    import LastUpdate from "/src/components/LastUpdate.svelte";
    import { rivers_map } from '$data/rivers/rivers-map.js';

    let mapComponent;
    const shown_routes = new SvelteSet();

    async function toggle_route_visibility(route) {
        const map = mapComponent.get_map();
        console.log(`Toggling route ${route.name}`);
        const key = route.name;
        if(shown_routes.has(key)) {
            shown_routes.delete(key);
            map.removeLayer(route.layer);
        }
        else {
            shown_routes.add(route.name);
            if(!route.layer) {
                const route_req = await fetch(rivers_map.get(key));
                const route_data = await route_req.json();
                const encoded_polylines = route_data.polylines;
                const decoded_features = encoded_polylines.map(encoded => {
                    const latlngs = decode(encoded).map(([lat, lng]) => ({lat, lng}));
                    return {
                        type: "Feature",
                        geometry: {
                            type: "LineString",
                            coordinates: latlngs.map(latlng => [latlng.lng, latlng.lat])
                        }
                    };
                });
                const geojson = {
                    type: "FeatureCollection",
                    features: decoded_features
                };
                route.layer = L.geoJSON(geojson, {
                    style: {
                        color: '#ff7800',
                        weight: 5,
                        opacity: 0.65
                    }
                });
            }
            route.layer.addTo(map);
            map.fitBounds(route.layer.getBounds());
        }
        setTimeout(() => filter_routes(), 50); // Update filtering after toggling
    }

    function filter_routes() {
        const query = document.querySelector('input#search-input').value.toLowerCase();
        const only_shown = document.querySelector('input#only-shown').checked;
        const groups = document.querySelectorAll('tbody');
                
        groups.forEach(group => {
            if(group.dataset.skipSearch === "true") {
                return;
            }
            let hasVisible = false;
            const buttons = group.querySelectorAll('button');
            buttons.forEach(button => {
                if(button.textContent.toLowerCase().includes(query) && (!only_shown || button.classList.contains('btn-primary'))) {
                    button.style.display = 'inline-block';
                    hasVisible = true;
                }
                else {
                    button.style.display = 'none';
                }
            });
            group.style.display = hasVisible ? '' : 'none';
        });
    }

    const routes_layers = new Map();
    let routes = [];

    let last_update_date = null;
    onMount(async () => {
        const map = mapComponent.get_map();
        const req = await fetch(new URL('$data/rivers/rivers.json', import.meta.url));
        const data = await req.json();
        routes = data.data;
        last_update_date = data.date;
        routes.sort((a, b) => {
            return a.name.localeCompare(b.name, 'bg', {numeric: true});
        });
    });
</script>

<Title title="Речна мрежа" />

<div class="row">
    <div class="col col-12 col-md-4">
        <table class="table table-bordered">
            <tbody data-skip-search="true">
                <tr class="table-primary">
                    <td>
                        <input class="form-control" type="text" placeholder="Търсене на река..." on:input="{filter_routes}" id="search-input"/>
                        <input type="checkbox" id="only-shown" on:change="{filter_routes}"/>
                        <label for="only-shown">Покажи само видимите реки на картата</label>
                    </td>
                </tr>
            </tbody>
            <tbody>
                <tr>
                    <td>
                        {#each routes as route}
                        <RoadNetworkRoadBtn route={route} is_shown={shown_routes.has(route.name)} label={route.name} on:click={() => toggle_route_visibility(route)} />
                        {/each}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div class="col col-12 col-md-8">
        <MapView bind:this={mapComponent} maxHeight={'900px'}/>
        <LastUpdate date={last_update_date} />
    </div>
</div>
