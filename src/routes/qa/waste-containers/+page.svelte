<script>
    import Title from '/src/components/Title.svelte';
    import MapView from '/src/components/MapView.svelte';
    import LastUpdate from '/src/components/LastUpdate.svelte';
    import { onMount } from 'svelte';
    import L from 'leaflet';
    import 'leaflet.markercluster';
    import 'leaflet.markercluster/dist/MarkerCluster.css';
    import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

    function generate_popup_content(group) {
        let content = '';
        for(const [i, container] of group.containers.entries()) {
            const waste_group = container_groups_by_type.find(g => g.name === container.cat);
            if(container.ids) {
                let c = 1;
                content += `<h5>${waste_group.label} (${container.ids.map(id => `<a href="https://osm.org/node/${id}" target="_blank">${c++}</a>`).join(', ')})</h5>`;
            }
            else {
                content += `<h5><a href="https://osm.org/node/${container.id}" target="_blank">${waste_group.label}</a></h5>`;
            }
            content += `Оператор: ${container.tags['operator'] ?? '<i>Неизвестен</i>'}<br>Брой: ${container.tags['count'] ?? '<i>Неизвестен</i>'}`;
            if(waste_group.name === 'package_recycling') {
                const mappings = {
                    'count:green': '🟢',
                    'count:yellow': '🟡',
                    'count:blue': '🔵',
                    'count:pet_drink_bottles': '💧'
                };
                for(const [tag, emoji] of Object.entries(mappings)) {
                    if(container.tags[tag]) {
                        content += `<br>${emoji}: ${container.tags[tag]}`;
                    }
                }
            }
            if(i < group.containers.length - 1) {
                content += '<hr>';
            }
        }
        return content;
    }

    let container_groups_by_type = $state([
        {
            name: 'waste_disposal',
            label: 'Контейнери за смесени отпадъци',
            bg_label: 'Битови отпадъци',
            emoji: '🗑️'
        },
        {
            name: 'package_recycling',
            label: 'Контейнери за разделно събиране',
            bg_label: 'Разделно събиране',
            emoji: '♻️',
            label_func: (tags) => {
                const operator = tags['operator'] ?? 'Неизвестен';
                const count = tags['count'] ?? '?';
                if(show_short_recycling_label) {
                    return `${count}x♻️`;
                }
                if(['Екопак', 'Екобулпак', 'Булекопак', 'Еко Партнърс'].includes(operator)) {
                    const colour_counts = ['green', 'yellow', 'blue', 'pet_drink_bottles'].map(colour => tags[`count:${colour}`] ?? '?');
                    const colour_emojies = ['🟢', '🟡', '🔵', '💧'];
                    const colour_parts = colour_counts
                    .map((count, index) => {
                        if(['?', '0'].includes(count)) {
                            return null;
                        }
                        return `${count}x${colour_emojies[index]}`;
                    })
                    .filter(part => part !== null);
                    if(colour_parts.length > 0) {
                        return `${count}x♻️ (${colour_parts.join(', ')})`;
                    }
                }
                return `${count}x♻️`;
            },
            is_complete_func: (tags) => {
                const required_tags = ['count:green', 'count:yellow', 'count:blue'];
                const required_operators = ['Екопак', 'Екобулпак', 'Булекопак', 'Еко Партнърс'];
                const operator = tags['operator'] ?? 'Неизвестен';
                if(required_operators.includes(operator)) {
                    if(required_tags.every(tag => tag in tags)) {
                        return true;
                    }
                }
                else {
                    return tags.count !== undefined;
                }
                return false;
            }
        },
        {
            name: 'clothes_recycling',
            label: 'Контейнери за дрехи',
            bg_label: 'Дрехи',
            emoji: '👕'
        },
        {
            name: 'electronic_recycling',
            label: 'Контейнери за електронни отпадъци',
            bg_label: 'Електронни отпадъци',
            emoji: '📱'
        },
        {
            name: 'battery_recycling',
            label: 'Контейнери за батерии',
            bg_label: 'Батерии',
            emoji: '🔋'
        },
        {
            name: 'bottle_return_machine',
            label: 'Машини за връщане на бутилки',
            bg_label: 'Връщане на бутилки',
            emoji: '🍼'
        },
        {
            name: 'cooking_oil',
            label: 'Контейнери за използвано готварско олио',
            bg_label: 'Готварско олио',
            emoji: '🛢️'
        },
        {
            name: 'plastic_caps',
            label: 'Контейнери за пластмасови капачки',
            bg_label: 'Пластмасови капачки',
            emoji: '🩷'
        },
        {
            name: 'drugs',
            label: 'Контейнери за лекарства с изтекъл срок на годност',
            bg_label: 'Лекарства',
            emoji: '💊'
        },
        {
            name: 'unknown_type',
            label: 'Неизвестен тип контейнер',
            bg_label: 'Неизвестен тип',
            emoji: '❓'
        },
        {
            name: 'unknown_waste',
            label: 'Неизвестен отпадък',
            bg_label: 'Неизвестен отпадък',
            emoji: '❓'
        }
    ]);
    let show_short_recycling_label = $state(true);
    let mapComponent;
    let last_update_date = $state(null);
    const container_groups = [];
    onMount(async () => {
        const markers = [];
        const raw_data = await fetch(new URL('./waste-containers.json', import.meta.url));
        const data = await raw_data.json();
        container_groups.push(...data.data);
        const map = mapComponent.get_map();
        last_update_date = new Date(data.date);
        const cluster_group = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 17,
        });
        for(const group of container_groups) {
            function find_avg_coords(containers) {
                let sum_lat = 0;
                let sum_lon = 0;
                let count = 0;
                for(const container of containers) {
                    if(container.coords && container.coords.length === 2) {
                        sum_lat += container.coords[0];
                        sum_lon += container.coords[1];
                        count ++;
                    }
                }
                if(count === 0) {
                    return [0, 0];
                }
                return [sum_lat / count, sum_lon / count];
            }
            const avg_coords = find_avg_coords(group.containers);
            const icon = get_group_icon(group.containers);
            const popup = L.popup().setContent('<span class="fs-5">' + generate_popup_content(group) + '</span><br><br>');

            group.marker = L.marker(avg_coords, {
                icon: icon,
                riseOnHover: true
            }).bindPopup(popup);
            markers.push(group.marker);
        }
        cluster_group.addLayers(markers);
        cluster_group.addTo(map);
        
        for(const waste_group of container_groups_by_type) {
            const location_count = container_groups
                .map(g => g.containers.filter(c => c.cat === waste_group.name).length)
                .reduce((curr, acc) => curr + acc, 0);
            waste_group.location_count = location_count;
        }
    });

    function get_group_icon(containers) {
        const labels = containers.map(container => {
            const waste_group = container_groups_by_type.find(g => g.name === container.cat);
            const is_complete = waste_group.is_complete_func ? waste_group.is_complete_func(container.tags) : container.tags.count !== undefined;
            const label_style = is_complete ? '' : 'bg-warning';
            const label_text = waste_group.label_func
                ? waste_group.label_func(container.tags)
                : `${container.tags.count ?? '?'}x${waste_group.emoji}`;
            if(label_style) {
                return `<span class="${label_style}">${label_text}</span>`;
            }
            return label_text;
        });
        return L.divIcon({
            html: `<span class="marker-label p-1 text-nowrap bg-white rounded-3 fs-6 text-center border border-2 border-dark">${labels.join('<br/>')}</span>`,
        });
    }

    function update_recycling_labels() {
        for(const group of container_groups) {
            if(!group.containers.some(c => c.cat === 'package_recycling')) {
                continue;
            }
            group.marker.setIcon(get_group_icon(group.containers));
        }
    }
</script>

<style>
    :global(.marker-label) {
        position: absolute;
        transform: translate(-50%, -50%);
        left: 0;
        top: 0;

        padding: 0.25rem 0.5rem;
        white-space: nowrap;
        border-radius: 0.5rem;
        font-size: 1.25rem;
        text-align: center;
    }
</style>

<Title title="Контейнери за отпадъци" />

<input class="form-check-input" type="checkbox" bind:checked={show_short_recycling_label} onchange={update_recycling_labels} id="short_recycling_label_checkbox" />
<label class="form-check-label mb-3" for="short_recycling_label_checkbox">
    Кратки етикети за контейнери за разделно събиране
</label>
<MapView bind:this={mapComponent} height="750px" startZoom={8} maxZoom={20} />
<LastUpdate date={last_update_date} />
<div class="modal" tabindex="-1" id="help_modal">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Помощ за картата</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <h5>Как да помогнете с подобряването на картата?</h5>
                <p>Картата използва данни от OpenStreetMap, които се събират от доброволци. Ако забележите проблем или неточност по картата, можете да помогнете с подобряването ѝ.</p>
                <h5>Как да редактирате картата?</h5>
                <h6>0. Регистрирайте се в OpenStreetMap</h6>
                <h6>1. Редактиране на картата</h6>
                Вариант 1 (уеб редактор):
                <ol>
                    <li>Отидете на <a href="https://www.openstreetmap.org/">https://www.openstreetmap.org/</a> и влезте в профила си.</li>
                    <li>Намерете локацията, която искате да редактирате, като използвате търсачката или навигирате по картата.</li>
                    <li>Кликнете на бутона "Edit" в горната част на страницата, за да влезете в режим на редактиране.</li>
                    <li>Намерете контейнера за отпадъци, който искате да редактирате, и кликнете върху него, за да изберете елемента на картата.</li>
                    <li>В панела за редактиране отдясно, можете да промените или добавите тагове към контейнера. За да бъде показан на картата, контейнерът трябва да има таг <code>count</code> със стойност (брой контейнери). За контейнери за разделно събиране, може да добавите допълнителни тагове като <code>count:green</code>, <code>count:yellow</code> и <code>count:blue</code>, за да посочите броя на контейнерите за различните видове отпадъци.</li>
                    <li>След като направите промените, кликнете на бутона "Save" в горната част на страницата, за да запазите редакциите си. Можете да добавите описание на промените, които сте направили, за да помогнете на другите потребители да разберат какво сте редактирали.</li>
                </ol>
                Вариант 2 (чрез мобилното приложение EveryDoor):
                <ol>
                    <li>Изтеглете приложението EveryDoor от App Store или Google Play.</li>
                    <li>Регистрирайте се в приложението и влезте в профила си.</li>
                    <li>Намерете локацията, която искате да редактирате, като използвате търсачката или навигирате по картата.</li>
                    <li>Кликнете на бутона "Edit" в горната част на страницата, за да влезете в режим на редактиране.</li>
                    <li>Намерете контейнера за отпадъци, който искате да редактирате, и кликнете върху него, за да изберете елемента на картата.</li>
                    <li>В панела за редактиране отдясно, можете да промените или добавите тагове към контейнера. За да бъде показан на картата, контейнерът трябва да има таг <code>count</code> със стойност (брой контейнери). За контейнери за разделно събиране, може да добавите допълнителни тагове като <code>count:green</code>, <code>count:yellow</code> и <code>count:blue</code>, за да посочите броя на контейнерите за различните видове отпадъци.</li>
                    <li>След като направите промените, кликнете на бутона "Save" в горната част на страницата, за да запазите редакциите си. Можете да добавите описание на промените, които сте направили, за да помогнете на другите потребители да разберат какво сте редактирали.</li>
                </ol>
            </div>
        </div>
    </div>
</div>
Забелязали сте проблем или неточност по картата? Вижте как да помогнете с подобряването ѝ <a href="#" data-bs-toggle="modal" data-bs-target="#help_modal">тук</a>.
<table class="table table-bordered mt-2">
    <thead>
        <tr class="table-secondary text-center">
            <th colspan="2">Легенда</th>
            <th>Брой локации</th>
        </tr>
    </thead>
    <tbody>
        {#each container_groups_by_type as group}
            <tr>
                <td class="text-center">{group.emoji}</td>
                <td>{group.label}</td>
                <td>{group.location_count ?? 'N/A'}</td>
            </tr>
        {/each}
    </tbody>
</table>
