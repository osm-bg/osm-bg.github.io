<script>
    import Title from '/src/components/Title.svelte';
    import MapView from '/src/components/MapView.svelte';
    import MotorwayMilestonePopup from '/src/components/MotorwayMilestonePopup.svelte';
    import { mount } from 'svelte';
    import { onMount } from 'svelte';
    import L from 'leaflet';
    import LastUpdate from '/src/components/LastUpdate.svelte';
    
    let motorways = [];
    const layer_100 = new L.LayerGroup();
    const layer_50 = new L.LayerGroup();
    const layer_10 = new L.LayerGroup();
    const layer_5 = new L.LayerGroup();
    const layer_all = new L.LayerGroup();
    let mapComponent = null;
    let last_update_date = null;
    onMount(async () => {
        const map = mapComponent.get_map();
        const data = await fetch(new URL('/src/data/motorway-milestones/milestones.json', import.meta.url).href)
        .then(res => res.json());
        last_update_date = data.date;
        motorways = data.data;
        console.log('milestones_data promise:', motorways);
        for(const motorway of motorways) {
            console.log(motorway);

            if(motorway.warnings.milestones.length) {
                for(const marker_data of motorway.warnings.milestones) {
                    const marker = L.marker(marker_data.coords);
                    let colour = 'danger';
                    if(marker_data.suspicious) {
                        colour = 'warning';
                    }
                    else if(marker_data.double) {
                        colour = 'success';
                    }
                    marker.setIcon(get_div_icon_with_number(marker_data.distance, colour));
                    const container = document.createElement('div');
                    console.log(marker_data);
                    const destroy = mount(MotorwayMilestonePopup, {
                        target: container,
                        props: { ids: typeof marker_data.osm_id === 'string' ? marker_data.osm_id.split(';') : [marker_data.osm_id], distance: marker_data.distance, motorway: motorway.name }
                    });
                    container._destroy = destroy;
                    marker.bindPopup(container);
                    const distance = marker_data.distance;
                    if(distance % 10 === 0) {
                        if(distance % 100 === 0) {
                            marker.addTo(layer_100);
                        }
                        else if(distance % 50 === 0) {
                            marker.addTo(layer_50);
                        }
                        else {
                            marker.addTo(layer_10);
                        }
                    }
                    else if(distance % 5 === 0) {
                        marker.addTo(layer_5);
                    }
                    else {
                        marker.addTo(layer_all);
                    }
                }
            }
        }
        map.on('zoom', () => {
            toggle_layers(layer_100, layer_50, layer_10, layer_5, layer_all);
        });
        toggle_layers(layer_100, layer_50, layer_10, layer_5, layer_all);
        function toggle_layers(layer_100, layer_50, layer_10, layer_5, layer_all) {
            const toggleLayer = function(map, layer, show) {
                if(show && !map.hasLayer(layer)) {
                    map.addLayer(layer);
                }
                else if(!show && map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            };
            const zoom = map.getZoom();
            toggleLayer(map, layer_100, zoom >= 7);
            toggleLayer(map, layer_50, zoom >= 8);
            toggleLayer(map, layer_10, zoom >= 9);
            toggleLayer(map, layer_5, zoom >= 11);
            toggleLayer(map, layer_all, zoom >= 13);
        }
    });
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
<LastUpdate date={last_update_date} />
<div class="row">
    <div class="col-8">
        <table class="table table-sm">
            <thead>
                <tr class="table-secondary">
                    <th>Автомагистрала</th>
                    <th>Налични</th>
                    <th>Липсващи</th>
                </tr>
            </thead>
            <tbody>
                {#each motorways as motorway}
                <tr>
                    <td>{motorway.name}</td>
                    <td>{motorway.ranges.map(([start, end]) => `${start} - ${end}`).join(', ')}</td>
                    <td>{reduce_array_to_ranges(motorway.warnings.missing).map((range) => range.length==2?`${range[0]} - ${range[1]}`:range).join(', ')}</td>
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
