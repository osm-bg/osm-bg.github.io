import fs from 'fs';
import queryOverpass from '@derhuerst/query-overpass';

const motorway_prefix = 'Автомагистрала';

function distance(coords1: [number, number], coords2: [number, number], options: {units: 'meters'}): number {
    const [lat1, lon1] = coords1;
    const [lat2, lon2] = coords2;

    const R = 6371000; // Radius of the Earth in meters
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

type Milestone = {
    osmType: 'node';
    osmId: number;
    distance: number;
    coords: [number, number];
    double?: boolean;
};

type RoadWithMilestones = {
    osmType: 'relation';
    osmId: number;
    name: string;
    validRanges: Array<{
        start: number;
        end: number;
    }>;
    milestones: Milestone[];
};

function getData() {
    const query = `[out:json][timeout:25];
area["name"="България"]->.searchArea;
(
rel[route=road][network="bg:motorway"](area.searchArea);
  )->.rels;

(.rels; >;)->.ways;
.rels out body;
.ways out body;`
    return queryOverpass(query);
}

function preprocessMilestones(milestones) {
    return milestones.map((milestone) => {
        const distance = parseFloat(milestone.tags.distance);
        const coords = [milestone.lat, milestone.lon] as [number, number];
        return {
            osmType: milestone.type,
            osmId: milestone.id,
            distance,
            coords
        };
    });
}

function mergeCloseMilestones(milestones: Milestone[]) {
    for (let i = 0; i < milestones.length - 1; i++) {
        const current = milestones[i];
        if (current.double) continue;
        const first_occurance_index = milestones.findIndex((potential_match, j) =>
            i != j && potential_match.distance === current.distance);
        if (first_occurance_index !== -1) {
            const match = milestones[first_occurance_index];
            const coords1 = current.coords;
            const coords2 = match.coords;
            const distance_between = distance(coords1, coords2, {units: 'meters'});
            if(distance_between > 100) continue;

            match.double = true;
            match.coords = [
                (coords1[0] + coords2[0]) / 2,
                (coords1[1] + coords2[1]) / 2
            ];
            match.osmId += `;${current.osmId}`;
            milestones.splice(i, 1);
        }
        else {
            current.double = false;
        }
    }
}

async function run() {
    const motorways = [
        { name: 'Тракия', validRanges: [
            { start: 0, end: 360 }
        ]},
        { name: 'Хемус', validRanges: [
            { start: 0, end: 87 },
            { start: 312, end: 414 }
        ]},
        { name: 'Марица', validRanges: [
            { start: 0, end: 117 }
        ]},
        { name: 'Струма', validRanges: [
            { start: 0, end: 105 },
            { start: 128, end: 168 }
        ]},
        { name: 'Черно море', validRanges: [
            { start: 0, end: 8 }
        ]},
        { name: 'Европа', validRanges: [
            { start: 0, end: 63 }
        ]}
    ];

    const osmData = await getData();
    for (const motorway of motorways) {
        const motorwayRelation = osmData.find((element) =>
            element.type === 'relation' &&
            element.tags &&
            element.tags.name === `${motorway_prefix} ${motorway.name}`);
        if (!motorwayRelation) {
            console.error(`No relation found for motorway ${motorway.name}`);
            process.exit(1);
        }
        motorway.milestonesFromRelation = [];
        for (const member of motorwayRelation.members) {
            if (member.type !== 'way') continue;
            const wayId = member.ref;
            const way = osmData.find((element) =>
                element.type === 'way' && element.id === wayId);
            if (!way) continue;
            for (const nodeId of way.nodes) {
                const node = osmData.find((element) =>
                    element.type === 'node' && element.id === nodeId);
                if (!node) continue;
                if (node.tags && node.tags.highway === 'milestone') {
                    motorway.milestonesFromRelation.push(node);
                }
            }
        }

    }
    for (const motorway of motorways) {
        console.log(`Found ${motorway.milestonesFromRelation.length} milestones for ${motorway.name}`);
        const milestones = preprocessMilestones(motorway.milestonesFromRelation);
        mergeCloseMilestones(milestones);
        motorway.milestones = milestones;
        console.log(`After merging, ${milestones.length} milestones (down from ${motorway.milestonesFromRelation.length}) remain for ${motorway.name}`);
        delete motorway.milestonesFromRelation;
    }

    const outDir = 'src/data/milestones';
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const dataForSaving: OSMData = {
        pointInTime: new Date().toISOString(),
        data: motorways
    };
    fs.writeFileSync(
        `${outDir}/data.json`,
        JSON.stringify(dataForSaving, null, 2)
    );
}

run();
