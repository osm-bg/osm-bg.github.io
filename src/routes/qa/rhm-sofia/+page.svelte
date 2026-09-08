<script lang="ts">
    import { onMount } from 'svelte';
    import MapView from '/src/components/MapView.svelte';

    let mapComponent = null;

    const colours = $state({
        'full_match': {
            label: 'Full Match (WD & RHM & OSM)',
            count: 0,
            colour: '#2E7D32',      // Verified Match (Green)
            isShown: true,
            group: new L.LayerGroup(),
        },
        'partial_match': {
            label: 'Match Candidate',
            count: 0,
            colour: '#D32F2F',   // Needs Attention (Amber)
            isShown: true,
            group: new L.LayerGroup(),
        },
        'not_on_osm': {
            label: 'RHM & WD not OSM',
            count: 0,
            colour: '#0284C7',      // OSM Gap / To Add (Blue)
            isShown: true,
            group: new L.LayerGroup(),
        },
        'not_on_official': {
            label: 'OSM & WD not RHM',
            count: 0,
            colour: '#7B1FA2', // Unofficial / Local Only (Purple)
            isShown: true,
            group: new L.LayerGroup(),
        },
        'no_match': {
            label: 'OSM only',
            count: 0,
            colour: '#ED6C02',        // Unmatched / Error (Red)
            isShown: true,
            group: new L.LayerGroup(),
        }
    });
    $effect(() => {
        if (!mapComponent) return;
        const map = mapComponent.get_map();
        if (!map) return;

        Object.values(colours).forEach(item => {
            if (item.isShown) {
                if (!map.hasLayer(item.group)) {
                    item.group.addTo(map);
                }
            } else {
                if (map.hasLayer(item.group)) {
                    map.removeLayer(item.group);
                }
            }
        });
    });
    function addMapMarker(match, map) {
        let colour = colours.no_match;
        if (!match.osm && match.official) {
            colour = colours.not_on_osm;
        }
        else if (match.osm && !match.official) {
            if (match.osm.tags.wikidata) {
                colour = colours.not_on_official;
            }
            else {
                colour = colours.no_match;
            }
        }
        else {
            if (match.osm.rhmId && match.official.properties.rhmId && match.osm.rhmId === match.official.properties.rhmId) {
                colour = colours.full_match;
            }
            else if (match.osm.tags.wikidata && match.official.properties.wikidata && match.osm.tags.wikidata === match.official.properties.wikidata) {
                colour = colours.full_match;
            }
            else {
                colour = colours.partial_match;
            }
        }

        colour.count += 1;
        
        const marker = L.marker([match.osm?.lat || match.official.geometry.coordinates[1], match.osm?.lon || match.official.geometry.coordinates[0]], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${colour.colour}; width: 12px; height: 12px; border-radius: 50%;"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
            }),
        });
        colour.group.addLayer(marker);
        const popupContent = `
            <div>
                <strong>OSM:</strong> ${match.osm?.name || 'N/A'}<br>
                <strong>RHM:</strong> ${match.official?.properties.xLabel || 'N/A'}<br>
                <strong>Match Type:</strong> ${match.matchType || 'N/A'}<br>
                ${match.official ? showTags(match.official.properties.rhmId || '', match.official.properties.wikidata || '') : ''}<br>
                ${match.osm ? `<a href="https://www.openstreetmap.org/${match.osm.osmType}/${match.osm.osmId}" target="_blank">${match.osm.osmType}/${match.osm.osmId}</a>` : ''}
                ${!match.osm && match.official ? `<br><a href="https://openstreetmap.org/?mlat=${match.official.geometry.coordinates[1]}&mlon=${match.official.geometry.coordinates[0]}&zoom=18" target="_blank">View on OSM</a>` : ''}
            </div>
        `;
        marker.bindPopup(popupContent);
    }

    function buildRhmSofiaUrl(rhmId: string): string {
        return `<a href="https://registersofia.bg/?option=com_monuments&view=monument&formdata[id]=${rhmId}" target="_blank">${rhmId}</a>`;
    }

    function buildWikidataUrl(wikidataId: string): string {
        return `<a href="https://www.wikidata.org/wiki/${wikidataId}" target="_blank">${wikidataId}</a>`;
    }

    function showTags(rhmId, wikidata): string {
        return `ref:BG:rhm_sofia = ${buildRhmSofiaUrl(rhmId || '')}<br>wikidata = ${buildWikidataUrl(wikidata || '')}`;
    }

    function matchElements(osmElement: any, officialElement: any) {
        let matchTypes = [];
        if (osmElement.rhmId && osmElement.rhmId === officialElement.properties.rhmId) {
            matchTypes.push('rhmId');
        }
        if (osmElement.tags.wikidata && osmElement.tags.wikidata === officialElement.properties.wikidata) {
            matchTypes.push('wikidata');
        }
        return matchTypes.length > 0 ? matchTypes.join(';') : null;
    }

    function findMatches(osmData: any, officialData: any, map: any) {
        const matches = [];
        outer:
        for (const osmFeature of osmData) {
            for (const officialFeature of officialData) {
                if (officialFeature.properties.matched) {
                    continue;
                }
                const matchType = matchElements(osmFeature, officialFeature);
                if (!matchType) {
                    continue;
                }
                matches.push({
                    osm: osmFeature,
                    official: officialFeature,
                    matchType: matchType
                });
                osmFeature.matched = true;
                officialFeature.properties.matched = true;
                continue outer;
            }
        }
        outer:
        for (const osmFeature of osmData) {
            if (osmFeature.matched) {
                continue;
            }
            for (const officialFeature of officialData) {
                if (officialFeature.properties.matched) {
                    continue;
                }
                const distance = Math.sqrt(
                    Math.pow(osmFeature.lat - officialFeature.geometry.coordinates[1], 2) +
                    Math.pow(osmFeature.lon - officialFeature.geometry.coordinates[0], 2)
                );
                const distanceInMeters = distance * 111139; // Approximate conversion from degrees to meters
                if (distanceInMeters < 20) {
                    matches.push({
                        osm: osmFeature,
                        official: officialFeature,
                        matchType: 'distance'
                    });
                    osmFeature.matched = true;
                    officialFeature.properties.matched = true;
                    continue outer;
                }
            }
        }
        for (const osmFeature of osmData) {
            if (!osmFeature.matched) {
                matches.push({
                    osm: osmFeature,
                    official: null,
                });
            }
        }
        for (const officialFeature of officialData) {
            if (!officialFeature.properties.matched) {
                matches.push({
                    osm: null,
                    official: officialFeature,
                });
            }
        }
        for (const match of matches) {
            addMapMarker(match, map);
        }
        return matches;
    }
    let matches: any[] = $state([]);
    onMount(async () => {
        const osmResponse = await fetch(new URL('/src/data/rhm-sofia/osm-data.json', import.meta.url));
        const osmData = await osmResponse.json();

        const officialResponse = await fetch(new URL('/src/data/rhm-sofia/rhm-data.geojson', import.meta.url));
        const officialData = (await officialResponse.json()).features.map(f => {
            f.properties = {
                ...f.properties,
                wikidata: 'Q' + f.properties.x.split('Q')[1],
            };
            return f;
        });
        matches = findMatches(osmData, officialData, map);
    });
</script>

<div class="row">
    <div class="col-10">
        <h2>Карта</h2>
        <MapView bind:this={mapComponent} height="700px" maxZoom={22} center={[42.697738, 23.321707]} startZoom={14}/>
    </div>
    <div class="col-2">
        <table class="table table-sm table-bordered text-center">
            <thead>
                <tr>
                    <th colspan="3">Легенда</th>
                </tr>
                <tr>
                    <th> </th>
                    <th>Цвят</th>
                    <th>Значение</th>
                    <th>Брой</th>
                </tr>
            </thead>
            <tbody>
                {#each Object.entries(colours) as [key, value]}
                    <tr>
                        <td><input type="checkbox" bind:checked={value.isShown}></td>
                        <td><div style="background-color: {value.colour}; width: 12px; height: 12px; border-radius: 50%;"></div></td>
                        <td>{value.label}</td>
                        <td>{value.count}</td>
                    </tr>
                {/each}
                <tr>
                    <td colspan="3"><strong>Общо</strong></td>
                    <td><strong>{Object.values(colours).reduce((acc, curr) => acc + curr.count, 0)}</strong></td>
                </tr>
        </table>
    </div>
</div>
<hr>
<table class="table table-sm table-bordered">
    <thead>
        <tr>
            <th>OSM</th>
            <th>RHM</th>
            <th>Match</th>
        </tr>
    </thead>
    <tbody>
        {#each matches as match}
            <tr>
                <td>
                    {match.osm?.name || 'N/A'}
                    {#if match.osm}
                        <br>
                        <a href={`https://www.openstreetmap.org/${match.osm.osmType}/${match.osm.osmId}`} target="_blank">OSM Link</a>
                    {/if}
                </td>
                <td>
                    {match.official?.properties.xLabel || 'N/A'}
                    {#if match.official}
                        {@const lat = match.official.geometry.coordinates[1]}
                        {@const lon = match.official.geometry.coordinates[0]}
                        <br>
                        <a href={`https://openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=18`} target="_blank">View on OSM</a>
                    {/if}
                </td>
                <td>
                    {match.osm && match.official ? 'Match' : 'No Match'}
                    {match.matchType ? ` (${match.matchType})` : ''}
                </td>
            </tr>
        {/each}
    </tbody>
</table>
