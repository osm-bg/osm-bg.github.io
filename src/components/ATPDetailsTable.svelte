<script>
    import { onMount } from 'svelte';
    let {map, external_data, compare_keys, checked} = $props();
    let rowspan = $derived(compare_keys && compare_keys.length > 0 ? compare_keys.length : 1);
    function get_tag_value(tags, key) {
        return tags && tags[key] ? tags[key] : '';
    }
    function determine_row_colour(osm_value, atp_value) {
        if(!osm_value && atp_value) {
            return 'bg-success-subtle';
        }
        else if(osm_value && atp_value && osm_value !== atp_value) {
            return 'bg-warning-subtle';
        }
        else if(osm_value && !atp_value) {
            return 'bg-danger-subtle';
        }
        return '';
    }
    let filtered_items = $derived(
        external_data.filter(item => checked[item.marker_type])
    );
</script>
<table class="table table-bordered table-sm">
    <thead>
        <tr class="table-secondary text-center">
            <th>Адрес</th>
            <th>Разстояние</th>
            <th colspan="3">Тагове</th>
        </tr>
    </thead>
    <tbody>
        {#if filtered_items.length > 0}
            {#each filtered_items as element}
                {@const osm = element?.osm}
                {@const atp = element?.atp}
                {@const coords = element?.osm?.coordinates || element?.atp?.coordinates}
                <tr>
                    {#if element.atp}
                        <td rowspan={rowspan}>
                            {element.atp.tags['addr:city'] || ''} {element.atp.tags['addr:street_address'] || element.atp.tags['full_addr'] || 'N/A'}
                            <br>
                            <button onclick={() => map.flyTo(coords, 17, { animate: false })} class="btn btn-sm btn-link">[Покажи на картата]</button>
                        </td>
                    {:else}
                        <td rowspan={rowspan}>N/A</td>
                    {/if}
                    <td rowspan={rowspan}>
                        {#if element.dist > 100}
                            <i class="bg-danger text-white fw-bold bi-exclamation-triangle"></i>
                        {/if}
                        {element.dist >= 0 ? `${Math.round(element.dist, 0)} м` : 'N/A'}</td>
                    {#if compare_keys.length > 0}
                        {@const compare_key = compare_keys[0]}
                        {@const osm_value = get_tag_value(element?.osm?.tags, compare_key)}
                        {@const atp_value = get_tag_value(element?.atp?.tags, compare_key)}
                        {@const colour_class = determine_row_colour(osm_value, atp_value)}
                        <td class={colour_class}>
                            <strong>{compare_key}</strong>
                        </td>
                        <td class={colour_class}>
                            {osm_value}
                        </td>
                        <td class={colour_class}>
                            {atp_value}
                        </td>
                    {:else}
                        <td colspan="3">Няма данни за сравнение</td>
                    {/if}
                    <td>
                        {#if osm}
                            <button 
                                class="btn btn-sm btn-secondary"
                                onclick={navigator.clipboard.writeText('\n\n' + compare_keys.map((k) => `${k}=${atp.tags[k]}`).join('\n'))}>Копирай таговете</button>
                            <a href={`https://www.openstreetmap.org/${osm.type}/${osm.id}`} target="_blank" class="btn btn-sm btn-primary text-white">OSM</a>
                            <a href={`https://www.openstreetmap.org/edit?editor=id&${osm.type}=${osm.id}`} target="_blank" class="btn btn-sm btn-primary text-white">iD</a>
                        {:else}
                            <a href={`https://www.openstreetmap.org/#map=19/${atp.coordinates[0]}/${atp.coordinates[1]}`} target="_blank" class="btn btn-sm btn-primary text-white">Покажи в OSM</a>
                            <a href={`https://www.openstreetmap.org/edit?editor=id#map=19/${atp.coordinates[0]}/${atp.coordinates[1]}`} target="_blank" class="btn btn-sm btn-primary text-white">Покажи в iD</a>
                        {/if}
                    </td>
                </tr>
                {#if compare_keys && compare_keys.length > 1}
                    {#each compare_keys as compare_key, index}
                        {#if index > 0}
                            {@const osm_value = get_tag_value(element?.osm?.tags, compare_key)}
                            {@const atp_value = get_tag_value(element?.atp?.tags, compare_key)}
                            {@const colour_class = determine_row_colour(osm_value, atp_value)}
                            <tr>
                                <td class={colour_class}>
                                    <strong>{compare_key}</strong>
                                </td>
                                <td class={colour_class}>
                                    {osm_value}
                                </td>
                                <td class={colour_class}>
                                    {atp_value}
                                </td>
                            </tr>
                        {/if}
                    {/each}
                {/if}
            {/each}
        {:else}
            <tr>
                <td colspan="5" class="text-center">Няма данни за показване</td>
            </tr>
        {/if}
    </tbody>
</table>
