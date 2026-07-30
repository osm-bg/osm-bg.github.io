// import { markerClusterGroup } from 'leaflet.markercluster';
import { make_osm_link } from '$lib/js/utils.js';
import { onMount } from 'svelte';

export function load_data() {
	return fetch(`/qa/atp-osm/data/metadata.json`)
	.then(res => res.json())
	.then(data => data.list.sort((a, b) => a.spider_name.localeCompare(b.spider_name) || a.key.localeCompare(b.key)  || a.value.localeCompare(b.value)))
	.then(data => {
		console.log(data);
		const groups = [];
		for(const spider of data) {
			const existing_group = groups.find(group => group.key === spider.key && group.value === spider.value);
			if(existing_group) {
				existing_group.spiders.push(spider);
			}
			else {
				groups.push({
					key: spider.key,
					value: spider.value,
					spiders: [spider]
				});
			}
		}
		groups.sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value));
		console.log(groups);
		return groups;
	});
}
