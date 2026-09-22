import queryOverpass from '@derhuerst/query-overpass';


class itemFilter {
    type: 'node' | 'way' | 'relation' | 'nwr' | 'nw'
    includeTags?: Record<string, string>
    includeKeys?: string[]
    excludeTags?: Record<string, string>
    excludeKeys?: string[]
}

const overpassOptions = {
    endpoint: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
};

export async function queryOverpassWithFilters(filters: itemFilter[], area: string = 'България'): Promise<any> {
    const filterStrings: string[] = [];
    for (const filter of filters) {
        const includeTags = filter.includeTags?.map(([key, value]) => `["${key}"="${value}"]`).join('') || '';
        const includeKeys = filter.includeKeys?.map(key => `["${key}"]`).join('') || '';
        const excludeTags = filter.excludeTags?.map(([key, value]) => `["${key}"!="${value}"]`).join('') || '';
        const excludeKeys = filter.excludeKeys?.map(key => `["${key}"!="${key}"]`).join('') || '';
        filterStrings.push(`${filter.type}(area.searchArea)${includeTags}${includeKeys}${excludeTags}${excludeKeys};`);
    }
    const query = `
        [out:json][timeout:25];
        area["name"="${area}"]->.searchArea;
        (
            ${filterStrings.join('\n            ')}
        );
        out center;
    `;
    console.log(`Query: ${query}`);
    return await queryOverpass(query, overpassOptions);
}



export async function queryOverpassWithCustomQuery(customQuery: string, area: string = 'България'): Promise<any> {
    const query = `
        [out:json][timeout:25];
        area["name"="${area}"]->.searchArea;
        ${customQuery}
    `;
    console.log(`Query: ${query}`);
    return await queryOverpass(query, overpassOptions);
}
