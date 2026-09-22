<script>
    import Title from '/src/components/Title.svelte';
    import MarkerMap from '/src/components/MarkerMap.svelte';
    import { onMount } from 'svelte';
    import LastUpdate from '/src/components/LastUpdate.svelte';
    
    const groups = [
        { name: '100km', minZoom: 7, count: 0, layer: new L.LayerGroup(), inclusionFunction: (d) => d.tags.distance % 100 === 0 },
        { name: '050km', minZoom: 8, count: 0, layer: new L.LayerGroup(), inclusionFunction: (d) => d.tags.distance % 50 === 0 },
        { name: '010km', minZoom: 9, count: 0, layer: new L.LayerGroup(), inclusionFunction: (d) => d.tags.distance % 10 === 0 },
        { name: '005km', minZoom: 11, count: 0, layer: new L.LayerGroup(), inclusionFunction: (d) => d.tags.distance % 5 === 0 },
        { name: '001km', minZoom: 13, count: 0, layer: new L.LayerGroup(), inclusionFunction: (d) => d.tags.distance % 1 === 0 }
    ];

    let lastUpdateDate = $state.raw(null);
    let milestonesData = $state.raw([]);
    onMount(async () => {
        const response = await fetch(new URL('/src/data/milestones/data.json', import.meta.url));
        const data = await response.json();
        lastUpdateDate = data.pointInTime;
        const motorways = data.data;
        milestonesData = motorways.flatMap(motorway => 
            motorway.milestones.map(m => (
                { 
                    ...m, 
                    tags: {
                        ...m.tags,
                        motorway: motorway.name
                    }
                }
            )
        ));
    });

    function generateIconWithNumber({tags}) {
        const distance = tags.distance;
        let colour = 'danger';
        if(tags.fixme) {
            colour = 'warning';
        }
        else if(tags.double) {
            colour = 'success';
        }
        const classes = `text-white bg-${colour} text-center fs-${distance >= 100 ? 6 : 5} rounded-2`;
        return L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="${classes}">${distance}</div>`,
            iconSize: [34, 42],
            iconAnchor: [17, 21]
        });
    }

    function generatePopupContent({tags, osmIds}) {
        return `<div class="text-center">
            <h5>${tags.distance} км, АМ ${tags.motorway}</h5>
            ${tags.fixme ? `<p class="text-danger"><i class="bi bi-exclamation-triangle"></i> ${tags.fixme}</p>` : ''}
            ${tags.double ? '<p class="text-success">Потвърден</p>' : ''}
            ${osmIds.map(id => `<a href="https://osm.org/node/${id}" target="_blank">n${id}</a>`).join(', ')}
        </div>`;
    }

    function toggleLayers(groups, map) {
        const zoom = map.getZoom();
        for (const group of groups) {
            if (zoom >= group.minZoom && !map.hasLayer(group.layer)) {
                console.log(`Adding layer ${group.name} at zoom ${zoom}`);
                map.addLayer(group.layer);
            }
            else if (zoom < group.minZoom && map.hasLayer(group.layer)) {
                console.log(`Removing layer ${group.name} at zoom ${zoom}`);
                map.removeLayer(group.layer);
            }
        }
    }

    const mapEvents = {
        zoom: (e) => {
            const map = e.target;
            toggleLayers(groups, map);
        }
    };
</script>

<Title title="Километрични маркери"/>

{#if milestonesData.length === 0}
    <p>Зареждане на данни...</p>
{:else}
<MarkerMap 
    markerIconFunction={generateIconWithNumber}
    markers={milestonesData}
    groups={groups}
    popupFunction={generatePopupContent}
    mapEvents={mapEvents}
     />
{/if}
<LastUpdate date={lastUpdateDate} />

<table class="table table-sm">
<thead>
    <tr class="table-secondary text-center">
        <th colspan="2">Легенда</th>
    </tr>
</thead>
<tbody>
    <tr>
        <td>
            <span class="text-white bg-success text-center fs-5 rounded-2">&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </td>
        <td>Потвърден маркер</td>
    </tr>
    <tr>
        <td>
            <span class="text-white bg-warning text-center fs-5 rounded-2">&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </td>
        <td>Маркер с fixme</td>
    </tr>
    <tr>
        <td>
            <span class="text-white bg-danger text-center fs-5 rounded-2">&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </td>
        <td>Непотвърден маркер</td>
    </tr>
</tbody>
</table>