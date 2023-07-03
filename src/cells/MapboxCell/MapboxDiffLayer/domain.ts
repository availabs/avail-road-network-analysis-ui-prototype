import * as turf from "@turf/turf";

import { CellID } from "../../domain";

export type LayerID = string;

export type LayerMeta = {
  layer_id: LayerID;
  layer_dependency_id_a: CellID | null;
  layer_dependency_id_b: CellID | null;
  layer_offset: number;
  layer_visible: boolean;
};

export type Tmc = string;

export type TmcFeature = turf.Feature<turf.MultiLineString, turf.Properties>;

export enum TmcType {
  "P1.11" = "cross-roads",
  "P1.3" = "motorway junction",
  "P4.0" = "link road point",
  "P3.14" = "border/frontier",
  "P1.1" = "motorway intersection",
  "P3.2" = "bridge",
  "P1.13" = "intermediate node",
  "P1.8" = "roundabout",
  "P3.16" = "toll plaza",
  "P3.3" = "service area",
  "P3.1" = "tunnel",
  "P3.37" = "place name",
  "P3.18" = "harbour",
  "P3.4" = "rest area",
  "P1.7" = "underpass",
  "P1.6" = "flyover",
  "P3.17" = "ferry terminal",
  "P3.27" = "airport",
  "P1.10" = "traffic lights",
}

export type CrossingEdge = {
  tmc: string;
  bearing: number;
  roadname: string;
  direction: string;
  roadnumber: string;
};

export type TraversedCrossingMeta = {
  tmcs: Tmc[];
  node_id: number;
  firstnames: string[];
  linear_ids: number[];
  pt_geom_idx: 1;
  inbound_edges: CrossingEdge[];
  outbound_edges: CrossingEdge[];
  dist_along_path_meters: number;
};

export type NodeIncidentTmcMeta = {
  tmc: string;
  direction: string;
  linear_id: number;
};

export type TmcNetworkDescription = {
  tmc: Tmc;
  firstname: string | null;
  is_nhs: boolean | null;
  roadname: string | null;
  roadnumber: string | null;
  miles: number;
  state: string;
  end_longitude: number;
  county: string;
  direction: string;
  start_longitude: number;
  type: string;
  road_order: number;
  func_class: number;
  zip: string;
  start_latitude: number;
  linear_id: number;
  end_latitude: number;
  start_node_id: number;
  start_node_idx: number;
  end_node_id: number;
  end_node_idx: number;
  length_meters: number;
  traversed_crossings_meta: TraversedCrossingMeta[];
  start_node_inbound_tmcs: NodeIncidentTmcMeta[];
  end_node_outbound_tmcs: NodeIncidentTmcMeta[];
};

export type TmcCrossYearSimilarity = {
  tmc: Tmc;
  length_meters_a: number;
  length_meters_b: number;
  straight_line_dist_meters_a: number;
  straight_line_dist_meters_b: number;
  bearing_degrees_a: number;
  bearing_degrees_b: number;
  sinuosity_a: number;
  sinuosity_b: number;
  start_pt_diff_meters: number;
  end_pt_diff_meters: number;
  hausdorff_distance_meters: number;
  frechet_distance_meters: number;
};

export type TmcCrossYearReference = {
  tmc: "120+25380";
  linear_id_a: "12003689";
  direction_a: "WESTBOUND";
  start_node_id_a: 15569;
  start_node_pt_geom_idx_a: 1;
  start_node_idx_along_path_a: 40;
  start_dist_along_path_meters_a: 746.75039997;
  end_node_id_a: 15402;
  end_node_idx_a: 4;
  end_node_idx_along_path_a: 43;
  end_dist_along_path_meters_a: 877.47180477;
  reference_node_id_a: 15112;
  reference_node_idx_along_path_a: 59;
  reference_node_dist_along_path_a: 2342.04438466;
  reference_node_is_on_tmc_a: false;
  tmc_start_dist_from_reference_node_a: -1595.29398469;
  tmc_end_dist_from_reference_node_a: -1464.57257989;
  linear_id_b: "12003689";
  direction_b: "NORTHBOUND";
  start_node_id_b: 15939;
  start_node_pt_geom_idx_b: 1;
  start_node_idx_along_path_b: 19;
  start_dist_along_path_meters_b: 396.80655288;
  end_node_id_b: 15533;
  end_node_idx_b: 10;
  end_node_idx_along_path_b: 28;
  end_dist_along_path_meters_b: 792.29258621;
  reference_node_id_b: 15533;
  reference_node_idx_along_path_b: 28;
  reference_node_dist_along_path_b: 792.29258621;
  reference_node_is_on_tmc_b: true;
  tmc_start_dist_from_reference_node_b: -395.48603333;
  tmc_end_dist_from_reference_node_b: 0;
  node_id_a: 15112;
  node_id_b: 15533;
  label: [[12003510, 12003689], [12003510, 12003689]];
  label_fields: ["linear_id"];
  conformal_level: "3.002";
  match_class: null;
  start_node_reference_rank_a: "7";
  end_node_reference_rank_a: "7";
  start_node_reference_rank_b: "3";
  end_node_reference_rank_b: "1";
};

export type TmcCrossYearDescription = {
  tmc_net_description_a: TmcNetworkDescription;
  tmc_net_description_b: TmcNetworkDescription;
  tmc_cross_year_similarity: TmcCrossYearSimilarity;
  tmc_cross_year_reference: TmcCrossYearReference;
};
