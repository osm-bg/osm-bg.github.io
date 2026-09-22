<script lang="ts">
    import { onMount } from "svelte";

    export let markers = [];
    export let groups: { name: string; visible: boolean; count: number; layer: L.LayerGroup }[] = [];
    export let popupFunction = (d) => d;
    export let markerIconFunction = false;
    export let allowCategoryToggle: boolean = false;
    export let showStats: boolean = false;
    export let markerInMultipleGroups = false;
    export let mapEvents = {};


    import MapView from "./MapView.svelte";
    let mapView;
    let map = null;
    onMount(async () => {
        console.log('MarkerMap onMount', markers, groups);
        map = mapView.get_map();
        for (const [eventName, eventHandler] of Object.entries(mapEvents)) {
            map.on(eventName, eventHandler);
        }
        for (const d of markers) {
            console.log('Adding marker', d);
            const mapMarker = L.marker(d.coords);
            if (markerIconFunction) {
                mapMarker.setIcon(markerIconFunction(d));
            }
            if (popupFunction) {
                mapMarker.bindPopup(popupFunction(d));
            }
            if (groups.some(g => g.inclusionFunction)) {
                for (const group of groups) {
                    if (group.inclusionFunction && group.inclusionFunction(d)) {
                        console.log(`Adding marker ${d} to group ${group.name}`);
                        group.count++;
                        mapMarker.addTo(group.layer);
                        if (!markerInMultipleGroups) {
                            break;
                        }
                    }
                }
            }
            else {
                const group = groups.find(g => g.name === d.group);
                if (group) {
                    group.count++;
                    mapMarker.addTo(group.layer);
                }
            }
        }

        if (mapEvents.zoom) {
            mapEvents.zoom({ target: map });
        }
        else {
            for (const group of groups) {
                group.layer.addTo(map);
            }
        }
    });
</script>

<MapView bind:this={mapView} />

{#if showStats}
    <table>
        <thead>
            <tr>
                <th>Group</th>
                <th>Count</th>
            </tr>
        </thead>
        <tbody>
            {#each groups as group}
                <tr>
                    <td>
                        {#if allowCategoryToggle}
                            <input type="checkbox" bind:checked={group.visible} on:change={() => toggleGroupVisibility(group)} />
                        {/if}
                        {group.name}
                    </td>
                    <td>{group.count}</td>
                </tr>
            {/each}
        </tbody>
    </table>
{/if}