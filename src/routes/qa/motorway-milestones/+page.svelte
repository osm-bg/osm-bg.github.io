<script>
    import Title from '/src/components/Title.svelte';
    import MapView from '/src/components/MapView.svelte';
    import MotorwayMilestonePopup from '/src/components/MotorwayMilestonePopup.svelte';
    import { mount } from 'svelte';
    import { onMount } from 'svelte';
    import L from 'leaflet';
    import LastUpdate from '/src/components/LastUpdate.svelte';
    
    let motorways = [];

    const LAYERS = [
        { minZoom: 7,  mod: 100, layer: new L.LayerGroup() },
        { minZoom: 8,  mod: 50,  layer: new L.LayerGroup() },
        { minZoom: 9,  mod: 10,  layer: new L.LayerGroup() },
        { minZoom: 11, mod: 5,   layer: new L.LayerGroup() },
        { minZoom: 13, mod: 1,   layer: new L.LayerGroup() }
    ];

    let mapComponent = null;
    let lastUpdateDate = null;
    onMount(async () => {
        const map = mapComponent.get_map();
        const response = await fetch(new URL('/src/data/milestones/data.json', import.meta.url));
        const data = await response.json();
        lastUpdateDate = data.pointInTime;
        motorways = data.data;
        for(const motorway of motorways) {
            for(const marker_data of motorway.milestones) {
                const mapMarker = L.marker(marker_data.coords);
                let colour = 'danger';
                if(marker_data.fixme) {
                    colour = 'warning';
                }
                else if(marker_data.double) {
                    colour = 'success';
                }
                mapMarker.setIcon(get_div_icon_with_number(marker_data.distance, colour));
                
                // popup
                const container = document.createElement('div');
                const destroy = mount(MotorwayMilestonePopup, {
                    target: container,
                    props: { marker: marker_data, motorway: motorway.name }
                });
                container._destroy = destroy;
                mapMarker.bindPopup(container);

                // grouping
                const distance = marker_data.distance;
                const match = LAYERS.find(cfg => distance % cfg.mod === 0) || LAYERS.at(-1);
                mapMarker.addTo(match.layer);
            }
        }
        map.on('zoom', updateLayers);
        function updateLayers() {
            const zoom = map.getZoom();
            LAYERS.forEach(({ minZoom, layer }) => {
                if (zoom >= minZoom && !map.hasLayer(layer)) {
                    map.addLayer(layer);
                }
                else if (zoom < minZoom && map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            });
        }
        updateLayers();
    });

    function findMissingMilestones(motorway, milestones) {
        const all = new Set();
        for (const range of motorway.validRanges) {
            for (let i = range.start; i <= range.end; i++) {
                all.add(i);
            }
        }
        const present = new Set(milestones.map(m => m.distance));
        const missing = all.symmetricDifference(present);

        const missingArray = Array.from(missing).sort((a, b) => a - b);
        const missingRanges = reduce_array_to_ranges(missingArray);
        console.log(missingRanges)
        return missingRanges;
    }

    function reduce_array_to_ranges(array) {
        const ranges = [];
        let start = array[0];
        let end = array[0];
        for(let i = 1; i < array.length; i++) {
            if(array[i] - end === 1) {
                end = array[i];
            }
            else {
                ranges.push([start, end]);
                start = array[i];
                end = array[i];
            }
        }
        ranges.push([start, end]);
        for(let i = 0; i < ranges.length; i++) {
            if(ranges[i][0] === ranges[i][1]) {
                ranges[i] = ranges[i][0];
            }
        }
        return ranges;
    }

    function get_div_icon_with_number(number, color) {
        return L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="text-white bg-${color} text-center fs-${number>=100?6:5} rounded-2">${number}</div>`,
            iconSize: [34, 42],
            iconAnchor: [17, 21]
        });
    }
</script>

<Title title="Километрични маркери"/>

<MapView bind:this={mapComponent} startZoom={8} minZoom={7} height="700px"/>
<LastUpdate date={lastUpdateDate} />
<div class="row">
    <div class="col-8">
        <table class="table table-sm">
            <thead>
                <tr class="table-secondary">
                    <th>Автомагистрала</th>
                    <th>Километри по официални данни</th>
                    <th>Липсващи</th>
                </tr>
            </thead>
            <tbody>
                {#each motorways as motorway}
                <tr>
                    <td>{motorway.name}</td>
                    <td>{motorway.validRanges.map(({ start, end }) => `${start} - ${end}`).join(', ')}</td>
                    <td>{findMissingMilestones(motorway, motorway.milestones).map((range) => range.length==2?`${range[0]} - ${range[1]}`:range).join(', ')}</td>
                </tr>
                {/each}
            </tbody>
        </table>
    </div>
    <div class="col-4">
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
    </div>
</div>
