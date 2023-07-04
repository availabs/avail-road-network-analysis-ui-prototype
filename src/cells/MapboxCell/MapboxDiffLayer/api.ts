import * as turf from "@turf/turf";
import _ from "lodash";

import { API_URL } from "../../../config/api";

import getTmcFeatures from "../../../api/getTmcFeatures";

import { CellLookup } from "../../CellsContext";

import { Tmc } from "./domain";
import { CellID, CellType } from "../../domain";

import getBaseMapDescriptorForYear from "../../../utils/getBaseMapDescriptorForYear";

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

export async function getTmcFeatureCollections(
  cells: CellLookup,
  layer_dependency_id_a: CellID | null,
  map_year_a: number | undefined,
  layer_dependency_id_b: CellID | null,
  map_year_b: number | undefined
) {
  const feature_collections = await Promise.all(
    [
      [layer_dependency_id_a, map_year_a],
      [layer_dependency_id_b, map_year_b],
    ].map(async ([layer_dependency_id, map_year], x) => {
      // We use the pseudo_root_cell_id to insert a Map Year cell descriptor if needed.
      const pseudo_root_cell_id = -(x + 1);

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

        console.log("getTmcFeatureCollections:", {
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
        if (
          !meta.dependencies?.length &&
          meta.cell_type !== CellType.MapYearCell
        ) {
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

      console.log({ layer_dependency_id, map_year, dependency_cells_meta });

      const [
        {
          // @ts-ignore
          descriptor: { year },
        },
      ] = dependency_cells_meta;

      console.log(dependency_cells_meta);

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

      const features = await getTmcFeatures(year, tmcs);

      const feature_collection = turf.featureCollection(features);

      return feature_collection;
    })
  );

  return feature_collections;
}
