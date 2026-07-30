<script>
    import Title from "/src/components/Title.svelte";
    import MapView from "/src/components/MapView.svelte";
    import RoadNetworkRoadBtn from "/src/components/RoadNetworkRoadBtn.svelte";
    import { onMount } from "svelte";
    import L from 'leaflet';
    import { decode } from 'google-polyline';
    import { SvelteSet } from 'svelte/reactivity';
    import LastUpdate from "/src/components/LastUpdate.svelte";
    import { routes_map } from '$data/road-routes/routes-map.js';

    let mapComponent;
    const shown_routes = new SvelteSet();

    async function toggle_route_visibility(route) {
        const map = mapComponent.get_map();
        console.log(`Toggling route ${route.ref}`);
        if(shown_routes.has(route.ref)) {
            shown_routes.delete(route.ref);
            map.removeLayer(route.layer);
        }
        else {
            shown_routes.add(route.ref);
            if(!route.layer) {
                const route_req = await fetch(routes_map.get(route.ref.toString()));
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
    let routes_by_category = [];
    const municipality_code_map = [
        ['BLG', 'Благоевград'],
        ['BGS', 'Бургас'],
        ['VTR', 'Велико Търново'],
        ['VAR', 'Варна'],
        ['VID', 'Видин'],
        ['VRC', 'Враца'],
        ['DOB', 'Добрич'],
        ['GAB', 'Габрово'],
        ['HKV', 'Хасково'],
        ['KRZ', 'Кърджали'],
        ['KNL', 'Кюстендил'],
        ['LOV', 'Ловеч'],
        ['MON', 'Монтана'],
        ['PAZ', 'Пазарджик'],
        ['PER', 'Перник'],
        ['PVN', 'Плевен'],
        ['PDV', 'Пловдив'],
        ['RAZ', 'Разград'],
        ['RSE', 'Русе'],
        ['SLS', 'Силистра'],
        ['SLV', 'Сливен'],
        ['SFO', 'София-област'],
        ['SOF', 'София-град'],
        ['SZR', 'Стара Загора'],
        ['SHU', 'Шумен'],
        ['SML', 'Смолян'],
        ['TGV', 'Търговище'],
        ['HKV', 'Хасково'],
        ['JAM', 'Ямбол']
    ];

    let last_update_date = null;
    onMount(async () => {
        const map = mapComponent.get_map();
        const req = await fetch(new URL('$data/road-routes/routes.json', import.meta.url));
        const data = await req.json();
        const all_routes = data.data;
        last_update_date = data.date;
        all_routes.sort((a, b) => {
            if(typeof a.ref === 'number' && typeof b.ref === 'number') {
                return a.ref - b.ref;
            }
            const a_ref = typeof a.ref === 'number' ? a.ref : parseInt(a.ref.replace(/\D/g, ''));
            const b_ref = typeof b.ref === 'number' ? b.ref : parseInt(b.ref.replace(/\D/g, ''));
            return a_ref - b_ref;
        });

        routes_by_category.push({
            name: 'Автомагистрали',
            routes: all_routes
            .filter(route => route.type === 'motorway')
        });

        routes_by_category.push({
            name: 'Първокласни пътища',
            routes: all_routes
            .filter(route => route.type === 'national' && route.ref < 10)
        });

        routes_by_category.push({
            name: 'Второкласни пътища',
            routes: all_routes
            .filter(route => route.type === 'national' && 10 <= route.ref && route.ref < 100)
        });

        routes_by_category.push({
            name: 'Третокласни пътища',
            routes: all_routes
            .filter(route => route.type === 'national' && 100 <= route.ref)
        });

        for(const [code, label] of municipality_code_map) {
            routes_by_category.push({
                name: label,
                routes: all_routes
                .filter(route => route.type === 'municipal' && route.ref.startsWith(code))
            });
        }
        routes_by_category[0] = routes_by_category[0]; // Trigger reactivity for Svelte
    });
</script>

<Title title="Пътна мрежа" />

<div class="row">
    <div class="col col-12 col-md-4">
        <table class="table table-bordered">
            <tbody data-skip-search="true">
                <tr class="table-primary">
                    <td>
                        <input class="form-control" type="text" placeholder="Търсене на път..." on:input="{filter_routes}" id="search-input"/>
                        <input type="checkbox" id="only-shown" on:change="{filter_routes}"/>
                        <label for="only-shown">Покажи само видимите пътища на картата</label>
                    </td>
                </tr>
            </tbody>
            {#each routes_by_category as category}
            <tbody>
                <tr class="table-secondary">
                    <th>{category.name}</th>
                </tr>
                <tr>
                    <td>
                        {#each category.routes as route}
                        {@const prefix = route.type === 'national' ? 'I'.repeat(route.ref.toString().length)+'-' : ''}
                        <RoadNetworkRoadBtn route={route} is_shown={shown_routes.has(route.ref)} label={prefix + route.ref} on:click={() => toggle_route_visibility(route)} />
                        {/each}
                    </td>
                </tr>
            </tbody>
            {/each}
        </table>
    </div>
    <div class="col col-12 col-md-8">
        <MapView bind:this={mapComponent} maxHeight={'900px'}/>
        <LastUpdate date={last_update_date} />
    </div>
</div>
