<script>
    import { mount, unmount, onMount } from 'svelte';
    import { page } from '$app/stores';
    import { load_data } from './../app.js';
    import L from 'leaflet';
    import 'leaflet.markercluster';
    import 'leaflet.markercluster/dist/MarkerCluster.css';
    import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
    import Title from '/src/components/Title.svelte';
    import ATPTable from '/src/components/ATPTable.svelte';
    import ATPDetailsTable from '/src/components/ATPDetailsTable.svelte';
    import ATPLegend from '/src/components/ATPLegend.svelte';
    import MapView from '/src/components/MapView.svelte';
    import ATPPopup from '/src/components/ATPPopup.svelte';
    import { SvelteMap, SvelteSet } from 'svelte/reactivity';
    import LastUpdate from '/src/components/LastUpdate.svelte';
    let spider_data = $state(null);
    let last_update_date = $derived(spider_data?.metadata?.date);
    let spider_items = $derived(spider_data?.items || []);
    let compare_keys = $derived(spider_data?.metadata?.compare_keys || []);
    let mapComponent = null;
    let map = null;
    const counts = $state({
        atp_only: 0,
        osm_only: 0,
        different: 0,
        same: 0
    });
    let checked = $state({
        atp_only: false,
        osm_only: false,
        different: true,
        same: false
    });
    let cluster = null;

    $effect(() => {
        const state_filter = {...checked}

        if (!cluster || !spider_items.length) return;
        const to_add = [];
        for(const point of spider_items) {
            if(!checked[point.marker_type]) {
                continue;
            }
            to_add.push(point.marker);
        }
        cluster.clearLayers();
        cluster.addLayers(to_add);
    });
    
    onMount(async () => {
        map = mapComponent.get_map();
        function generate_tags_table(osm, atp, compare_keys) {
            const tags_table = {};
            if(compare_keys === false) {
                return tags_table;
            }
            function add_tag(source, key, value) {
                if(!compare_keys.includes(key)) {
                    return;
                }
                if(!tags_table[key]) {
                    tags_table[key] = {};
                }
                tags_table[key][source] = value;
            }
            if(osm && osm.tags) {
                for(const [key, value] of Object.entries(osm.tags)) {
                    add_tag('osm', key, value);
                }
            }
            if(atp && atp.tags) {
                for(const [key, value] of Object.entries(atp.tags)) {
                    add_tag('atp', key, value);
                }
            }
            for(const [key, value] of Object.entries(tags_table)) {
                value.colour = determine_row_colour(value.osm, value.atp);
            }
            return tags_table;
        }
        function determine_row_colour(osm_value, atp_value) {
            if(!osm_value && atp_value) {
                return 'table-success';
            }
            else if(osm_value && atp_value && osm_value !== atp_value) {
                return 'table-warning';
            }
            else if(osm_value && !atp_value) {
                return 'table-danger';
            }
            return '';
        }
        function determine_icon_url(point, compare_keys) {
            const {osm, atp} = point;
            function distance(coord1, coord2) {
                const xdiff = coord1[0] - coord2[0];
                const ydiff = coord1[1] - coord2[1];
                return Math.sqrt(xdiff * xdiff + ydiff * ydiff) * 111320; // approximate conversion to meters
            }
            function compare_kv(osm_value, atp_value) {
                if(osm_value === atp_value) {
                    return false;
                }
                if(!osm_value && atp_value) {
                    return true;
                }
                else if(osm_value && atp_value && osm_value !== atp_value) {
                    return true;
                }
                else if(osm_value && !atp_value) {
                    return true;
                }
                return false;
            }
            const icons = {
                atp_only: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                osm_only: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                different: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
                same: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png'
            };
            let iconUrl = icons.same;
            if(osm && !atp) {
                iconUrl = icons.osm_only;
                point.marker_type = 'osm_only';
                counts.osm_only++;
            } 
            else if(!osm && atp) {
                iconUrl = icons.atp_only;
                point.marker_type = 'atp_only';
                counts.atp_only++;
            }
            else if(distance(osm.coordinates, atp.coordinates) > 100 || (compare_keys !== false && compare_keys.some(k => compare_kv(osm.tags?.[k], atp.tags?.[k])))) {
                iconUrl = icons.different;
                point.marker_type = 'different';
                counts.different++;
            }
            else {
                point.marker_type = 'same';
                counts.same++;
            }
            return iconUrl;
        }
        const spider = $page.params.slug;

        const data = await fetch(new URL(`/src/data/atp-osm/${spider}.json`, import.meta.url));
        spider_data = await data.json();
        spider_data.items = spider_data.items.sort((a, b) => (a.dist >= 0 ? a.dist : +Infinity) - (b.dist >= 0 ? b.dist : +Infinity));

        function bind_lazy_popup(marker, point, compare_keys, tags_table, main_tag) {
            marker.on('click', () => {
            // Only mount if it's not already mounted
                if (!marker.getPopup()) {
                    const container = document.createElement('div');
                    const component = mount(ATPPopup, {
                        target: container,
                        props: { point, compare_keys, tags_table, main_tag }
                    });
                    container._svelte_component = component;
                
                    marker.bindPopup(container).openPopup();
                }
            });
        }

        cluster = L.markerClusterGroup({
            chunkedLoading: true,
            showCoverageOnHover: false,
        });
        const markers_for_adding = [];
        spider_data.items.forEach(p => {
            const coordinates = p.osm ? p.osm.coordinates : p.atp.coordinates;
            const tags_table = generate_tags_table(p.osm, p.atp, compare_keys);
            const icon = L.icon({
                iconUrl: determine_icon_url(p, compare_keys),
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
            });
            const marker = L.marker(coordinates, { icon });
            
            // marker.bindPopup(create_popup(p, compare_keys, tags_table, ''));
            bind_lazy_popup(marker, p, compare_keys, tags_table, '');
            p.marker = marker;
            if (checked[p.marker_type]) {
                markers_for_adding.push(marker);
            }
        });

        cluster.addLayers(markers_for_adding);
        map.addLayer(cluster);
        map.on('popupclose', e => {
            e.popup.getContent()?.destroy?.();
        });
    });
</script>

<Title title={spider_data?.metadata?.name + ' - ATP - OSM Интеграция'}/>

<div class="row">
    <div class="col-12 col-sm-10">
        <div>
            <MapView bind:this={mapComponent} height="700px" startZoom="8"/>
        </div>
    </div>
    <div class="col-12 col-sm-2">
        <div class="alert alert-warning d-none" id="fuzzy_coords_notice">
            <span class="fw-bold">Възможни значителни отклонения в координатите (50-200 метра)</span>
        </div>
        <ATPLegend counts={counts} checked={checked}/>
        <LastUpdate date={last_update_date}/>
    </div>
    <div class="col-12">
        <ATPDetailsTable external_data={spider_items} compare_keys={compare_keys} map={map} checked={checked}/>
    </div>
</div>
