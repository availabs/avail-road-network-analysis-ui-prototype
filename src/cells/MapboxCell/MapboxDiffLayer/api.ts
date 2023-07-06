import * as turf from "@turf/turf";
import _ from "lodash";

import { API_URL } from "../../../config/api";
import getTmcFeatures, { TmcFeature } from "../../../api/getTmcFeatures";

import { CellLookup } from "../../CellsContext";

import { Tmc } from "./domain";
import { CellID, CellType } from "../../domain";

import getBaseMapDescriptorForYear from "../../../utils/getBaseMapDescriptorForYear";

export type TmcFeatureCollection = turf.FeatureCollection<TmcFeature>;

export async function getTmcs(
  cells: CellLookup,
  layer_dependency_id: CellID,
  map_year: number
) {
  // We use the pseudo_root_cell_id to insert a Map Year cell descriptor if needed.
  const pseudo_root_cell_id = -1;

  const dependency_cells_meta: any[] = [];

  const seen_cell_ids = new Set();

  let pushed_pseudo_root = false;

  const deep_deps = _.flatten([
    layer_dependency_id,
    ...dependency_cells_meta.map(({ dependencies }) => dependencies),
  ]).filter(Boolean) as CellID[];

  for (let i = 0; i < deep_deps.length; ++i) {
    const cell_id = deep_deps[i];

    if (seen_cell_ids.has(cell_id)) {
      continue;
    }

    seen_cell_ids.add(cell_id);

    console.log("getTmcs:", {
      cell_id,
      pseudo_root_cell_id,
    });

    let { dependencies: cur_deps, meta } =
      cell_id !== pseudo_root_cell_id
        ? cells[cell_id]
        : {
            dependencies: null,
            meta: getBaseMapDescriptorForYear(
              map_year as number,
              pseudo_root_cell_id
            ),
          };

    // Is this dependency abstract?
    if (!meta.dependencies?.length && meta.cell_type !== CellType.MapYearCell) {
      meta = { ...meta, dependencies: [pseudo_root_cell_id] };
      if (!pushed_pseudo_root) {
        deep_deps.push(pseudo_root_cell_id);
        pushed_pseudo_root = true;
      }
    }

    dependency_cells_meta.push(meta);

    if (Array.isArray(cur_deps)) {
      for (const dep of cur_deps) {
        if (!seen_cell_ids.has(dep)) {
          deep_deps.push(dep);
        }
      }
    }
  }

  dependency_cells_meta.reverse();

  const response = await fetch(
    `${API_URL}/data-types/npmrds/network-analysis/getTmcs`,
    {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dependency: layer_dependency_id,
        dependency_cells_meta,
      }), // body data type must match "Content-Type" header
    }
  );

  const tmcs = await response.json();

  return tmcs;
}

export async function getTmcFeatureCollections(
  cells: CellLookup,
  layer_dependency_id_a: CellID,
  map_year_a: number,
  layer_dependency_id_b: CellID,
  map_year_b: number
) {
  const feature_collections = await Promise.all(
    [
      { cell_id: layer_dependency_id_a, map_year: map_year_a },
      { cell_id: layer_dependency_id_b, map_year: map_year_b },
    ].map(async ({ cell_id, map_year }) => {
      const tmcs = await getTmcs(cells, cell_id, map_year);

      const features = await getTmcFeatures(map_year, tmcs);

      const feature_collection = turf.featureCollection(features);

      return feature_collection;
    })
  );

  return feature_collections;
}

export async function getTmcsMetadata(year: number, tmcs: Tmc[]) {
  const response = await fetch(
    `${API_URL}/data-types/npmrds/network-analysis/getTmcsMetadata`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        year,
        tmcs,
      }), // body data type must match "Content-Type" header
    }
  );

  const metadata = await response.json();

  return metadata;
}

export async function getTmcLinearPathsMeta(year: number, tmcs: Tmc[]) {
  const response = await fetch(
    `${API_URL}/data-types/npmrds/network-analysis/getTmcLinearPathsMeta`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        year,
        tmcs,
      }), // body data type must match "Content-Type" header
    }
  );

  const metadata = await response.json();

  return metadata;
}

export async function getTmcNetworkDescription(
  year_a: number | null,
  year_b: number | null,
  clicked_tmc: Tmc | null
) {
  if (clicked_tmc === null) {
    return null;
  }

  if (year_a === null || year_b === null) {
    return null;
  }

  const [
    tmc_net_description_a,
    tmc_net_description_b,
    tmc_cross_year_similarity,
    tmc_cross_year_reference,
  ] = await Promise.all([
    (async () => {
      const url = new URL(
        `${API_URL}/data-types/npmrds/network-analysis/getTmcNetworkDescription`
      );

      url.searchParams.append("tmc", clicked_tmc);
      url.searchParams.append("year", `${year_a}`);

      const res = await fetch(url);

      return res.json();
    })(),

    (async () => {
      const url = new URL(
        `${API_URL}/data-types/npmrds/network-analysis/getTmcNetworkDescription`
      );

      url.searchParams.append("tmc", clicked_tmc);
      url.searchParams.append("year", `${year_b}`);

      const res = await fetch(url);

      return res.json();
    })(),

    (async () => {
      const url = new URL(
        `${API_URL}/data-types/npmrds/network-analysis/getTmcCrossYearSimilarity`
      );

      url.searchParams.append("tmc", clicked_tmc);
      url.searchParams.append("year", `${year_a}`);
      url.searchParams.append("year", `${year_b}`);

      const res = await fetch(url);

      return res.json();
    })(),

    (async () => {
      const url = new URL(
        `${API_URL}/data-types/npmrds/network-analysis/getTmcCrossYearReference`
      );

      url.searchParams.append("tmc", clicked_tmc);
      url.searchParams.append("year", `${year_a}`);
      url.searchParams.append("year", `${year_b}`);

      const res = await fetch(url);

      return res.json();
    })(),
  ]);

  const new_tmc_description = {
    tmc_net_description_a,
    tmc_net_description_b,
    tmc_cross_year_similarity,
    tmc_cross_year_reference,
  };

  console.log(new_tmc_description);

  return new_tmc_description;
}

type NodeID = string;
type LinearID = number;

type NodeIncidentEdge = {
  tmc: Tmc;
  bearing: number;
  firstname: string | null;
  linear_id: number;
  roadname: string;
  road_number: string;
};

type NodeDescription = {
  node_id: NodeID;
  firstnames: string[];
  inbound_edges: NodeIncidentEdge[];
  outbound_edges: NodeIncidentEdge[];
  linear_ids: number[];
  tmcs: Tmc[];
  longitude: number;
  latitude: number;
};

type NodeMetadata = {
  node_id: NodeID;
  firstnames: NodeDescription["firstnames"];
  inbound_tmcs: { tmc: Tmc; bearing: number }[];
  outbound_tmcs: { tmc: Tmc; bearing: number }[];
  linear_ids: LinearID[];
  longitude: number;
  latitude: number;
};

export async function getNodesForTmcs(tmcs: Tmc[], year: number) {
  const response = await fetch(
    `${API_URL}/data-types/npmrds/network-analysis/getNodesForTmcs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tmcs,
        year,
      }), // body data type must match "Content-Type" header
    }
  );

  const result: NodeDescription[] = await response.json();

  result.sort((a: any, b: any) => a.node_id - b.node_id);

  const node_metadata: NodeMetadata[] = [];
  const node_metadata_idx: Record<NodeID, number> = {};
  const node_ids_by_tmc: Record<Tmc, NodeID[]> = {};
  const node_ids_by_linear_id: Record<LinearID, NodeID[]> = {};
  const node_point_features: turf.Feature<turf.Point>[] = [];
  const node_point_features_idx: Record<NodeID, number> = {};

  for (let i = 0; i < result.length; ++i) {
    const {
      node_id,
      firstnames,
      linear_ids,
      inbound_edges,
      outbound_edges,
      longitude,
      latitude,
      tmcs,
    } = result[i];

    const inbound_tmcs = inbound_edges
      .sort((a, b) => a.bearing - b.bearing)
      .map(({ tmc, bearing }) => ({
        tmc,
        bearing,
      }));

    const outbound_tmcs = outbound_edges
      .sort((a, b) => a.bearing - b.bearing)
      .map(({ tmc, bearing }) => ({
        tmc,
        bearing,
      }));

    for (const tmc of tmcs) {
      node_ids_by_tmc[tmc] = node_ids_by_tmc[tmc] || [];
      node_ids_by_tmc[tmc].push(node_id);
    }

    for (const linear_id of linear_ids) {
      node_ids_by_linear_id[linear_id] = node_ids_by_linear_id[linear_id] || [];
      node_ids_by_linear_id[linear_id].push(node_id);
    }

    node_metadata.push({
      node_id,
      firstnames,
      inbound_tmcs,
      outbound_tmcs,
      linear_ids,
      longitude,
      latitude,
    });

    node_metadata_idx[node_id] = i;

    node_point_features.push(
      turf.point([longitude, latitude], null, { id: node_id })
    );

    node_point_features_idx[node_id] = i;
  }

  return {
    node_metadata,
    node_point_features,
    node_metadata_idx,
    node_ids_by_tmc,
    node_ids_by_linear_id,
    node_point_features_idx,
  };
}
