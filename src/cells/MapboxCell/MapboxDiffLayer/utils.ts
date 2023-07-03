import * as turf from "@turf/turf";
import _ from "lodash";
import { CellLookup } from "../../CellsContext";
import { CellID } from "../../domain";

import { LayerID, TmcFeature } from "./domain";

export function getSourceAndLayerNames(layer_id: LayerID) {
  const a_intxn = `${layer_id}::a_intxn`;
  const b_intxn = `${layer_id}::b_intxn`;
  const a_only = `${layer_id}::a_only`;
  const b_only = `${layer_id}::b_only`;

  const inxtn_polygons = `${layer_id}::intxn_polygons`;

  return {
    sources: {
      a_intxn: `${a_intxn}::source`,
      b_intxn: `${b_intxn}::source`,
      a_only: `${a_only}::source`,
      b_only: `${b_only}::source`,
      inxtn_polygons: `${inxtn_polygons}::source`,
    },
    layers: {
      a_intxn: `${a_intxn}::layer`,
      b_intxn: `${b_intxn}::layer`,
      a_only: `${a_only}::layer`,
      b_only: `${b_only}::layer`,
      inxtn_polygons_fill: `${inxtn_polygons}::fill::layer`,
      // inxtn_polygons_outline: `${inxtn_polygons}::outline::layer`,
    },
  };
}

export function getPolygons(geometries: [TmcFeature, TmcFeature]) {
  const a_coords = _.chunk(_.flattenDeep(turf.getCoords(geometries[0])), 2);
  const b_coords = _.chunk(_.flattenDeep(turf.getCoords(geometries[1])), 2);

  const combined_coords = [...a_coords, ...b_coords.reverse(), a_coords[0]];

  const line = turf.lineString(combined_coords);

  const tmc = geometries[0].properties!.tmc;

  const polygon = turf.lineToPolygon(line) as turf.Feature<
    turf.Polygon,
    turf.Properties
  >;

  polygon.properties = { tmc };

  const { features: polygons } = turf.unkinkPolygon(polygon);

  for (const poly of polygons) {
    poly.properties = { tmc };
  }

  return polygons;
}

export function getYearsFromLayerDependencies(
  cells: CellLookup,
  layer_dependency_id_a: CellID | null,
  layer_dependency_id_b: CellID | null
): [number | null, number | null] {
  const years = [layer_dependency_id_a, layer_dependency_id_b].map(
    (layer_dependency_id) => {
      if (layer_dependency_id === null) {
        return null;
      }

      const dependency_cells_meta = [cells[layer_dependency_id as number].meta];

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

      return year;
    }
  ) as [number, number];

  return years;
}
