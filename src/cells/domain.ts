export type CellID = number;

export enum MapSource {
  NPMRDS = "NPMRDS",
}

export enum NpmrdsTmcPropertySource {
  tmc_metadata = "tmc_metadata",
}

export enum CellType {
  MapYearCell = "Map Year Cell",
  MapFilterCell = "Map Filter Cell",
  MapboxCell = "Mapbox Cell",
  MapTraverseCell = "Map Traverse Cell",
}

export type CellAction = {
  type: string;
  payload: any;
};
