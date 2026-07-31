<script>
    export let marker;
    export let motorway;
</script>


<span>{motorway} км. {marker.distance}</span>
{#if marker.osmIds.length}
    <div>OSM IDs:
        {#each marker.osmIds as id, index}
            {#if index > 0}, {/if}
            <a href="https://osm.org/node/{id}" target="_blank">n{id}</a>
        {/each}
        {#if marker.fixme}
            <br>
            <i class="bi bi-exclamation-triangle-fill text-danger"></i>
            <span>Fixme: {marker.fixme}</span>
        {/if}
    </div>
{/if}