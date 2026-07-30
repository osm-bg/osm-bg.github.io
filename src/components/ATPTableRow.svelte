<script>
    export let spider_data = {};
    export let show_kv_instead_of_name = false;
    const {spider_name, key, value} = spider_data;
</script>

<tr>
    <td>
        {#if show_kv_instead_of_name}
            {key}={value}
        {:else}
            <a href="/qa/atp-osm/{key}-{value}-{spider_name}">
                {spider_data.name}
            </a>
        {/if}
    </td>
    <td>{spider_data.stats.atp}</td>
    <td>{spider_data.stats.osm}</td>
    <td>{spider_data.stats.percent_matched}%</td>
</tr>