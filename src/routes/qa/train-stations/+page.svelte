<script lang="ts">
    import { onMount } from 'svelte';

    const operator = 'НКЖИ';
    const operatorWikidata = 'Q6975183';

    if (!String.prototype.toCamelCase) {
        String.prototype.toCamelCase = function () {
            return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
        };
    }

    function transliterate(text: string): string {
        const cyrillicToLatinMap: Record<string, string> = {
            'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D',
            'Е': 'E', 'Ж': 'ZH', 'З': 'Z', 'И': 'I', 'Й': 'Y',
            'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
            'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
            'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh',
            'Щ': 'Sht', 'Ъ': 'A', 'Ь': 'Y', 'Ю': 'Yu', 'Я': 'Ya'
        };

        const newText = [];

        for (const letter of text.split('')) {
            const isLower = letter === letter.toLowerCase();
            if (cyrillicToLatinMap[letter.toUpperCase()]) {
                const newLetter = cyrillicToLatinMap[letter.toUpperCase()];
                if (isLower) {
                    newText.push(newLetter.toLowerCase());
                }
                else {
                    newText.push(newLetter.toCamelCase());
                }
            }
            else {
                newText.push(letter);
            }
        }
        const finalText = newText.join('');
        return finalText.replace('spirka', 'halt');
    }

    let officialData = $state.raw([]);
    let osmData = $state.raw([]);
    let matchedData = $state.raw([]);

    function findMatch(osmRow, officialData) {
        const matchOnUIC = officialData.find(officialRow => officialRow.uic === osmRow.uic);
        const matchOnNameStation = officialData.find(officialRow => officialRow.name && osmRow.name && !officialRow.name.endsWith('спирка') && officialRow.name.toUpperCase() === osmRow.name.toUpperCase());
        const matchOnNameStop = officialData.find(officialRow => officialRow.name && osmRow.name && officialRow.name.endsWith('спирка') && officialRow.name.replace('спирка', '').toUpperCase().trim() === osmRow.name.toUpperCase());
        if (osmRow.name === 'Средна Арда') {
            console.log(officialData.find(officialRow => officialRow.name === 'Средна Арда'.toUpperCase()));
            console.log('Found Средна Арда in OSM data');
            console.log(matchOnUIC, matchOnNameStation, matchOnNameStop);
        }
        return {
            matchOnUIC,
            matchOnName: matchOnNameStation || matchOnNameStop
        };
    }

    onMount(async () => {
        const yearsRange = '2026-2027';
        const stationsURL = `/src/data/train-stations/stations-${yearsRange}.json`;
        const stationsRes = await fetch(new URL(stationsURL, import.meta.url));
        const stationsData = await stationsRes.json();
        const stopsURL = `/src/data/train-stations/stops-${yearsRange}.json`;
        const stopsRes = await fetch(new URL(stopsURL, import.meta.url));
        const stopsData = await stopsRes.json();
        officialData = [...stationsData, ...stopsData];

        const osmURL = `/src/data/train-stations/osm-data.json`;
        const osmRes = await fetch(new URL(osmURL, import.meta.url));
        osmData = await osmRes.json();

        const local = [];
        for (const osm of osmData) {
            const { matchOnUIC, matchOnName } = findMatch(osm, officialData);
            if (matchOnUIC || matchOnName) {
                const officialMatch = matchOnUIC || matchOnName;
                const typeMatch = osm.tags['railway'] === (officialMatch.type === 'ГАРА' ? 'station' : officialMatch.type === 'СПИРКА' ? 'halt' : null);
                local.push({ official: officialMatch, osm, matchOnUIC, matchOnName, typeMatch });
                officialData = officialData.filter(officialRow => officialRow !== officialMatch);
            }
            else {
                local.push({ official: null, osm, matchOnUIC: false, matchOnName: false, typeMatch: false });
            }
        }
        for (const official of officialData) {
            local.push({ official, osm: null, matchOnUIC: false, matchOnName: false, typeMatch: false });
        }

        for (const match of local) {
            match.warnings = match.osm && match.official ? getWarnings(match.osm, match.official) : (!match.osm ? ['Няма OSM данни'] : ['Няма официални данни']);
        }
        local.sort((a, b) => b.warnings.length - a.warnings.length);
        matchedData = local;
        console.log(`Matched ${matchedData.length} out of ${officialData.length} official entries with OSM data.`);
    });

    function determineTags(row, tags = {}) {
        const tagsToAdd = [];
        if (row.uic && tags['uic_ref'] !== row.uic) {
            tagsToAdd.push(`uic_ref=${row.uic}`);
        }
        if (row.callsign && tags['railway:ref'] !== row.callsign) {
            tagsToAdd.push(`railway:ref=${row.callsign}`);
        }
        if (tags['operator'] !== operator) {
            tagsToAdd.push(`operator=${operator}`);
        }
        if (tags['operator:wikidata'] !== operatorWikidata) {
            tagsToAdd.push(`operator:wikidata=${operatorWikidata}`);
        }
        if (tags['name'] && (!tags['name:bg'] || tags['name:bg'] !== tags['name'])) {
            tagsToAdd.push(`name:bg=${tags['name']}`);
        }
        if (tags['name'] && (!tags['name:en'] || tags['name:en'] !== transliterate(tags['name']))) {
            tagsToAdd.push(`name:en=${transliterate(tags['name'])}`);
        }
        tagsToAdd.sort((a, b) => a.localeCompare(b));
        return tagsToAdd.join('\n');
    }

    function getWarnings(osm, official) {
        const warnings = [];
        const tags = osm.tags || {};
        const keys = Object.keys(tags);

        if (osm.osmType !== 'node') {
            warnings.push(`OSM обектът не е node (е ${osm.osmType})`);
        }

        if (official) {
            if (official.type === 'СПИРКА' && (!tags['railway'] || tags['railway'] !== 'halt')) {
                warnings.push(`Липсва/неправилен таг: railway=${tags["railway"] || "undefined"} (трябва да е "halt")`);
            }
            if (official.type === 'ГАРА' && (!tags['railway'] || tags['railway'] !== 'station')) {
                warnings.push(`Липсва/неправилен таг: railway=${tags["railway"] || "undefined"} (трябва да е "station")`);
            }
        }

        if (!tags['name']) {
            warnings.push(`Липсва таг: name`);
        }

        if (!tags['name:en']) {
            warnings.push(`Липсва таг: name:en`);
        }

        if (!tags['name:bg']) {
            warnings.push(`Липсва таг: name:bg`);
        }

        if (tags['building']) {
            warnings.push(`Непозволен таг: building=${tags['building']}`);
        }

        if (!tags['operator']) {
            warnings.push(`Липсва таг: operator, трябва да е "${operator}"`);
        }
        else if (tags['operator'] !== operator) {
            warnings.push(`Неправилен таг: operator=${tags['operator'] || "undefined"} (трябва да е "${operator}")`);
        }

        if (!tags['operator:wikidata']) {
            warnings.push(`Липсва таг: operator:wikidata=${tags['operator:wikidata'] || "undefined"} (трябва да е "${operatorWikidata}")`);
        }
        else if (tags['operator:wikidata'] !== operatorWikidata) {
            warnings.push(`Неправилен таг: operator:wikidata=${tags['operator:wikidata'] || "undefined"} (трябва да е "${operatorWikidata}")`);
        }

        if (!tags['uic_ref']) {
            warnings.push(`Липсва таг: uic_ref (трябва да е "${official?.uic || "undefined"}")`);
        }
        else if (official && tags['uic_ref'] !== official.uic) {
            warnings.push(`Неправилен таг: uic_ref=${tags['uic_ref'] || "undefined"} (трябва да е "${official.uic}")`);
        }

        const allowedNameTags = ['name', 'name:en', 'name:bg', 'uic_name'];

        for (const key of keys) {
            if (key.includes('name') && !allowedNameTags.includes(key)) {
                warnings.push(`Непозволен таг: ${key}`);
            }
        }

        return warnings;
    }
</script>

Общо обекти в ОСМ: {matchedData.filter(row => row.osm).length} | Общо официални обекти: {matchedData.filter(row => row.official).length} | Съвпадения: {matchedData.filter(row => row.official && row.osm).length} | Без официални данни: {matchedData.filter(row => !row.official).length} | Без OSM данни: {matchedData.filter(row => !row.osm).length}

Предупреждения: {matchedData.reduce((acc, row) => acc + row.warnings.length, 0)}

<br>

Обекти с предупреждения: {matchedData.filter(row => row.warnings.length > 0).length}

<table>
    <thead>
        <tr>
            <th>Тип</th>
            <th>Име (инициали)</th>
            <th>UIC код</th>
            <td>Съвпадение по</td>
            <th>Тагове</th>
            <th>OSM</th>
            <th>Предупреждения</th>
        </tr>
    </thead>
    <tbody>
        {#if false}
            <tr>
                <td colspan="10">Данните се зареждат...</td>
            </tr>
        {:else if matchedData.length === 0}
            <tr>
                <td colspan="10">Няма намерени резултати.</td>
            </tr>
        {:else}
            {#each matchedData as row}
                <tr>
                    {#if !row.official}
                        <td colspan="5">Няма официални данни за "{row.osm.name}" (или {row.osm.name && row.osm.name.endsWith('спирка') ? row.osm.name.replace('спирка', '').trim() : ''}) (UIC: {row.osm.uic})</td>
                    {:else}
                        <td>{row.official.type}</td>
                        <td>{row.official.name} {row.official.callsign ? `(${row.official.callsign})` : ''}</td>
                        <td>{row.official.uic}</td>
                        <td>{row.matchOnUIC ? '✅ UIC' : '❌ UIC'}<br>{row.matchOnName ? ' ✅ Име' : '❌ Име'}<br>{row.typeMatch ? ' ✅ Тип' : '❌ Тип'}</td>
                        <td>
                            <textarea readonly rows="3" class="form-control" on:click={copyToClipboard}>{row.official ? determineTags(row.official, row?.osm?.tags) : ''}</textarea>
                        </td>
                    {/if}
                    <td>
                        {#if !row.osm}
                            Няма OSM данни
                        {:else}
                            <a href={`https://www.openstreetmap.org/${row.osm.osmType}/${row.osm.osmId}`} target="_blank" rel="noopener noreferrer">
                                {row.osm.osmType}/{row.osm.osmId}
                            </a>
                        {/if}
                    </td>
                    <td>
                        {#if row.warnings.length > 0}
                            <div class="alert alert-warning">
                                <ul>
                                    {#each row.warnings as warning}
                                        <li>{warning}</li>
                                    {/each}
                                </ul>
                            </div>
                        {:else}
                            <span class="text-success">Няма предупреждения</span>
                        {/if}
                    </td>
                </tr>
            {/each}
        {/if}
    </tbody>
</table>