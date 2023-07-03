import * as turf from "@turf/turf";
import _ from "lodash";

import { API_URL } from "../../../config/api";

import getTmcFeatures from "../../../api/getTmcFeatures";

import { CellLookup } from "../../CellsContext";

import { Tmc } from "./domain";
import { CellID } from "../../domain";

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
  layer_dependency_id_b: CellID | null
) {
  const feature_collections = await Promise.all(
    [layer_dependency_id_a, layer_dependency_id_b].map(
      async (layer_dependency_id) => {
        const dependency_cells_meta = [
          cells[layer_dependency_id as number].meta,
        ];

        const seen_cell_ids = new Set([layer_dependency_id]);
        const deep_deps = _.flatten(
          dependency_cells_meta.map(({ dependencies }) => dependencies)
        ).filter(Boolean) as CellID[];

        for (let i = 0; i < deep_deps.length; ++i) {
          const cell_id = deep_deps[i];

          if (seen_cell_ids.has(cell_id)) {
            continue;
          }

          const { dependencies: cur_deps, meta } = cells[cell_id];

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

        const [
          {
            // @ts-ignore
            descriptor: { year },
          },
        ] = dependency_cells_meta;

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
      }
    )
  );

  return feature_collections;
}
