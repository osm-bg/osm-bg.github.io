import queryOverpass from '@derhuerst/query-overpass';
import fs from 'fs';

function getData() {
    return queryOverpass(`
        [out:json][timeout:25];
        area["name"="Столична"]->.searchArea;
        (
            nwr["tourism"="artwork"](area.searchArea);
            nwr["historic"="memorial"](area.searchArea);
            nwr["historic"="monument"](area.searchArea);
            nwr["ref:BG:rhm_sofia"](area.searchArea);
        );
        out center;
    `);
}

function parseData(data: any) {
    console.log(`Found ${data.length} artworks, memorials, monuments and rhm_sofia references`);
    return data.map((element: any) => {
        const name = element.tags.name;
        const lat = element.lat || (element.center && element.center.lat);
        const lon = element.lon || (element.center && element.center.lon);
        const osmType = element.type;
        const osmId = element.id;
        const tags = element.tags;
        const rhmId = element.tags['ref:BG:rhm_sofia'];
        return { name, lat, lon, osmType, osmId, tags, rhmId };
    });
}

function run() {
  return getData()
    .then(parseData)
    .then((data) => {
        const outDir = 'src/data/rhm-sofia'
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true })
        }
        fs.writeFileSync(
            `${outDir}/osm-data.json`,
            JSON.stringify(data, null, 2)
        )
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}

run();
