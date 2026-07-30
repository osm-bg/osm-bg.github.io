<script>
    import Title from '/src/components/Title.svelte';
    import { load_data } from './app.js';
    import { onMount } from 'svelte';
    import ATPTable from '/src/components/ATPTable.svelte';
    import ATPLegend from '/src/components/ATPLegend.svelte';
    import LastUpdate from '/src/components/LastUpdate.svelte';

    let groups = [];
    let last_update_date;
    onMount(async () => {
        console.log('onMount fired');
        groups = await load_data();
        last_update_date = new Date(groups.date);
        console.log('groups after load:', groups);
    });
</script>

<Title title="ATP - OSM Интеграция"/>

<div class="row">
    <div class="col-12 col-sm-5">
        <ATPTable spiders_data={groups} by_categories={true}/>
    </div>
    <div class="col-12 col-sm-7">
        <!-- <div>
            <button class="btn btn-outline-primary">Зареди всички данни</button>
        </div> -->
        <LastUpdate date={last_update_date} />
    </div>
</div>
