import fs from 'fs';
import { queryOverpassWithCustomQuery } from '../utils.ts';

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
    osmIds: number[];
    tags: {
        distance: string;
        fixme?: string;
        double: boolean;
    };
    coords: [number, number];
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
    const query =
        '(rel(area.searchArea)[network="bg:motorway"];)->.rels;'
        + '(.rels; >;)->.ways;'
        + '.rels out body;'
        + '.ways out body;';
    return queryOverpassWithCustomQuery(query);
}

function preprocessMilestones(milestones): Milestone[] {
    const numberRegex = /^\d+$/;
    return milestones.map((milestone) => {
        const isDistanceValid = milestone.tags.distance && numberRegex.test(milestone.tags.distance);
        if (!isDistanceValid) {
            console.warn(`Milestone with id ${milestone.id} has invalid distance: ${milestone.tags.distance}`);
            return null;
        }
        const coords = [milestone.lat, milestone.lon] as [number, number];
        const toReturn: Milestone = {
            osmType: milestone.type,
            osmIds: [milestone.id],
            tags: {
                distance: milestone.tags.distance,
                double: false
            },
            coords,
        };
        if (milestone.tags.fixme) {
            toReturn.tags.fixme = milestone.tags.fixme;
        }
        return toReturn;
    }).filter((v): v is Milestone => !!v);
}

function getAllIndexes(arr, value, notIndex) {
    const indexes = [];
    for (let i = 0; i < arr.length; i++) {
        if (i !== notIndex && arr[i].tags.distance === value) {
            indexes.push(i);
        }
    }
    return indexes.toReversed();
}

function mergeCloseMilestones(milestones: Milestone[]) {
    milestoneLoop:
    for (let i = milestones.length - 1; i >= 0; i--) {
        const current = milestones[i];
        if (current.tags.double) continue;
        let indexes = getAllIndexes(milestones, current.tags.distance, i);
        if (indexes.length === 0) {
            current.tags.double = false;
            continue;
        }
        for (const index of indexes) {
            const potemtialMatch = milestones[index];
            const coords1 = current.coords;
            const coords2 = potemtialMatch.coords;
            const distance_between = distance(coords1, coords2, {units: 'meters'});
            if(distance_between > 100) {
                console.warn(`Milestones with distance ${current.tags.distance} are too far apart: ${distance_between} meters`);
                console.log(`Milestone 1: ${JSON.stringify(current)}`);
                console.log(`Milestone 2: ${JSON.stringify(potemtialMatch)}`);
                continue;
            }

            current.tags.double = true;
            current.coords = [
                (coords1[0] + coords2[0]) / 2,
                (coords1[1] + coords2[1]) / 2
            ];
            current.osmIds.push(current.osmIds[0]);
            if (current.tags.fixme && potemtialMatch.tags.fixme && current.tags.fixme !== potemtialMatch.tags.fixme) {
                current.tags.fixme = `${current.tags.fixme};${potemtialMatch.tags.fixme}`;
            }
            milestones.splice(index, 1);
            continue milestoneLoop;
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

    const outDir = './src/data/milestones';
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
