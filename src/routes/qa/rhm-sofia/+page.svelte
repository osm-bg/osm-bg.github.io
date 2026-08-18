<script lang="ts">
    import { onMount } from 'svelte';
    import MapView from '/src/components/MapView.svelte';

    let mapComponent = null;

    const colours = {
        'full_match': '#2E7D32',      // Verified Match (Green)
        'partial_match': '#ED6C02',   // Needs Attention (Amber)
        'not_on_osm': '#0284C7',      // OSM Gap / To Add (Blue)
        'not_on_official': '#7B1FA2', // Unofficial / Local Only (Purple)
        'no_match': '#D32F2F',        // Unmatched / Error (Red)
    };
    function addMapMarker(match, map) {
        let colour = '';
        if (!match.osm && match.official) {
            colour = colours.not_on_osm;
        }
        else if (match.osm && !match.official) {
            colour = colours.not_on_official;
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
        
        const marker = L.marker([match.osm?.lat || match.official.geometry.coordinates[1], match.osm?.lon || match.official.geometry.coordinates[0]], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${colour}; width: 12px; height: 12px; border-radius: 50%;"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
            }),
        });
        marker.addTo(map);
        const popupContent = `
            <div>
                <strong>OSM:</strong> ${match.osm?.name || 'N/A'}<br>
                <strong>Official:</strong> ${match.official?.properties.xLabel || 'N/A'}<br>
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
    let matches: any[] = [];
    onMount(async () => {
        const map = mapComponent.get_map();
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
    <div class="col-11">
        <h2>Карта</h2>
        <MapView bind:this={mapComponent} height="700px" maxZoom={22} center={[42.697738, 23.321707]} startZoom={14}/>
    </div>
    <div class="col-1">
        <table class="table table-sm table-bordered text-center">
            <thead>
                <tr>
                    <th colspan="2">Легенда</th>
                </tr>
                <tr>
                    <th>Цвят</th>
                    <th>Значение</th>
                </tr>
            </thead>
            <tbody>
                {#each Object.entries(colours) as [key, value]}
                    <tr>
                        <td><div style="background-color: {value}; width: 12px; height: 12px; border-radius: 50%;"></div></td>
                        <td>{key.replace(/_/g, ' ')}</td>
                    </tr>
                {/each}
        </table>
        <table class="table table-sm table-bordered text-center">
            <tbody>
                <tr>
                    <th colspan="2">Статистика</th>
                </tr>
                <tr>
                    <td>Метрика / Описание</td>
                    <td>Брой обекти</td>
                </tr>
                <tr>
                    <td>ОСМ</td>
                    <td>{matches.filter(m => m.osm).length}</td>
                </tr>
                <tr>
                    <td>Мачнати (всички)</td>
                    <td>{matches.filter(m => m.osm && m.official).length}</td>
                </tr>
                <tr>
                    <td>Мачнати (по УД/РИМ)</td>
                    <td>{matches.filter(m => m.osm && m.official && m.matchType && (m.matchType.includes('wikidata') || m.matchType.includes('rhmId'))).length}</td>
                </tr>
                <tr>
                    <td>Официално</td>
                    <td>{matches.filter(m => m.official).length}</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
<hr>
<table class="table table-sm table-bordered">
    <thead>
        <tr>
            <th>OSM</th>
            <th>Official</th>
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
