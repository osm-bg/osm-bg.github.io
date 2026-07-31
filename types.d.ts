type Data = {
    pointInTime: string;
    data: object[];
}

type OSMData = Data

type ExternalData = Data

type OSMDataWithExternalData = {
    osmData: OSMData;
    externalData: ExternalData;
}
