import { useContext } from "react";

import { produce, Draft } from "immer";
import _ from "lodash";
import { Map } from "mapbox-gl"; // eslint-disable-line import/no-webpack-loader-syntax

import * as turf from "@turf/turf";

import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";

import AbstractCellState, {
  reducer as abstractMapCellReducer,
} from "../AbstractMapCellState";

import AbstractMapCellState from "../AbstractMapCellState";
import { MapYearCellState } from "../MapYearCell";

import { CellID, CellType } from "../domain";

import CellsContext from "../CellsContext";

export type LayerID = string;

export type LayerMeta = {
  layer_id: LayerID;
  layer_dependency_id_a: CellID | null;
  layer_dependency_id_b: CellID | null;
  layer_offset: number;
  layer_visible: boolean;
};

export enum CellActionType {
  ADD_LAYER = "ADD_LAYER",

  SET_LAYER_DEPENDENCY_A = "SET_LAYER_DEPENDENCY_A",
  SET_LAYER_DEPENDENCY_B = "SET_LAYER_DEPENDENCY_B",

  SET_LAYER_OFFSET = "SET_LAYER_OFFSET",
}

export type CellAction = {
  type: CellActionType;
  payload: any;
};

type TmcFeature = turf.Feature<turf.MultiLineString, turf.Properties>;

export function getPolygon(geometries: [TmcFeature, TmcFeature]) {
  const a_coords = _.chunk(_.flattenDeep(turf.getCoords(geometries[0])), 2);
  const b_coords = _.chunk(_.flattenDeep(turf.getCoords(geometries[1])), 2);

  const combined_coords = [...a_coords, ...b_coords.reverse(), a_coords[0]];

  const line = turf.lineString(combined_coords);

  const polygon = turf.lineToPolygon(line) as turf.Feature<
    turf.Polygon,
    turf.Properties
  >;

  return polygon;
}

export function mapboxDiffLayersReducer(
  cell: MapboxDiffLayerState,
  action: CellAction
) {
  cell = abstractMapCellReducer(cell, action) as MapboxDiffLayerState;

  const { type, payload } = action;

  if (type === CellActionType.ADD_LAYER) {
    console.log("==> CellActionType.ADD_LAYER");
    return cell.addLayer(payload);
  }

  if (type === CellActionType.SET_LAYER_DEPENDENCY_A) {
    const { layer_id, cell_id } = payload;
    return cell.setLayerDependencyA(layer_id, cell_id);
  }

  if (type === CellActionType.SET_LAYER_DEPENDENCY_B) {
    const { layer_id, cell_id } = payload;
    return cell.setLayerDependencyB(layer_id, cell_id);
  }

  if (type === CellActionType.SET_LAYER_OFFSET) {
    const { layer_id, layer_offset } = payload;
    return cell.setLayerOffset(layer_id, layer_offset);
  }

  return cell;
}

export class MapboxDiffLayerState extends AbstractCellState {
  readonly _descriptor: {
    layers: LayerMeta[];
  };

  constructor() {
    super(CellType.MapboxCell);

    this._descriptor = { layers: [] }; // put the layers and their styling here
  }

  get descriptor() {
    return this._descriptor;
  }

  get is_ready() {
    return !!this.dependencies?.length;
  }

  get dependencies() {
    return _.uniq(
      _.flatten(
        this.descriptor.layers
          .map(({ layer_dependency_id_a, layer_dependency_id_b }) => [
            layer_dependency_id_a,
            layer_dependency_id_b,
          ])
          .filter(Boolean)
      )
    ) as CellID[];
  }

  addLayer(layer_id: LayerID) {
    return produce(this, (draft: Draft<this>) => {
      const has_layer = draft._descriptor.layers.some(
        ({ layer_id: id }) => id === layer_id
      );

      if (has_layer) {
        return;
      }

      draft._descriptor.layers.push({
        layer_id,
        layer_dependency_id_a: null,
        layer_dependency_id_b: null,
        layer_offset: 1,
        layer_visible: true,
      });
    });
  }

  setLayerDependencyA(layer_id: LayerID, cell_id: CellID) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_dependency_id_a = cell_id;
    });
  }

  setLayerDependencyB(layer_id: LayerID, cell_id: CellID) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_dependency_id_b = cell_id;
    });
  }

  setLayerOffset(layer_id: LayerID, layer_offset: number) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_offset = layer_offset;
    });
  }
}

export function MapboxDiffLayerForm({
  this_cell_id,
  layer_meta,
  dispatch,
  map,
}: {
  this_cell_id: CellID;
  layer_meta: LayerMeta;
  dispatch: (action: CellAction) => void;
  map: Map;
}) {
  const {
    layer_id,
    layer_dependency_id_a,
    layer_dependency_id_b,
    layer_offset,
  } = layer_meta;

  const { cells } = useContext(CellsContext);

  const this_cell = cells[this_cell_id];

  if (!this_cell) {
    return null;
  }

  const dispatchLayerDependencyAChange = (cell_id: CellID) =>
    dispatch({
      type: CellActionType.SET_LAYER_DEPENDENCY_A,
      payload: {
        layer_id,
        cell_id,
      },
    });

  const dispatchLayerDependencyBChange = (cell_id: CellID) =>
    dispatch({
      type: CellActionType.SET_LAYER_DEPENDENCY_B,
      payload: {
        layer_id,
        cell_id,
      },
    });

  const dispatchLayerOffsetChange = (layer_offset: number) =>
    dispatch({
      type: CellActionType.SET_LAYER_OFFSET,
      payload: {
        layer_id,
        layer_offset,
      },
    });

  async function fetchTmcs() {
    console.log("FETCH TMCS");

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

          console.log(dependency_cells_meta);

          const response = await fetch(
            // "http://127.0.0.1:3369/dama-admin/dama_dev_1/data-types/npmrds/network-analysis/getTmcFeatures",
            "http://192.168.1.100:3369/dama-admin/dama_dev_1/data-types/npmrds/network-analysis/getTmcFeatures",
            {
              method: "POST", // *GET, POST, PUT, DELETE, etc.
              headers: {
                "Content-Type": "application/json",
              },
              // mode: "no-cors",
              body: JSON.stringify({
                dependency: layer_dependency_id,
                dependency_cells_meta,
              }), // body data type must match "Content-Type" header
            }
          );

          const feature_collection =
            (await response.json()) as turf.FeatureCollection<
              turf.MultiLineString,
              turf.Properties
            >;

          return feature_collection;
        }
      )
    );

    type TmcFeaturesById = Record<string, TmcFeature>;
    const layer_a_features_by_tmc: TmcFeaturesById = {};

    for (const feature of feature_collections[0].features) {
      const {
        // @ts-ignore
        properties: { tmc },
      } = feature;

      const offset = turf.lineOffset(feature, +layer_offset / 3, {
        units: "yards",
      });

      layer_a_features_by_tmc[tmc] = offset;
    }

    const layer_b_features_by_tmc: TmcFeaturesById = {};

    for (const feature of feature_collections[1].features) {
      const {
        // @ts-ignore
        properties: { tmc },
      } = feature;

      const offset = turf.lineOffset(feature, (+layer_offset * 2) / 3, {
        units: "yards",
      });

      layer_b_features_by_tmc[tmc] = offset;
    }

    const a_tmcs = Object.keys(layer_a_features_by_tmc);
    const b_tmcs = Object.keys(layer_b_features_by_tmc);

    // A ∩ B
    const a_and_b_tmcs = _.intersection(a_tmcs, b_tmcs);

    const a_intxn_feature_collection = turf.featureCollection(
      a_and_b_tmcs.map((tmc) => layer_a_features_by_tmc[tmc])
    );

    const a_intxn_layer_id = `${layer_id}::a_intxn`;

    try {
      map.removeLayer(a_intxn_layer_id);
      map.removeSource(a_intxn_layer_id);
    } catch (err) {}

    map.addSource(a_intxn_layer_id, {
      type: "geojson",
      data: a_intxn_feature_collection,
    });

    map.addLayer({
      id: a_intxn_layer_id,
      type: "line",
      source: a_intxn_layer_id,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#f3f700",
        "line-width": 1,
        // "line-offset": layer_offset,
      },
    });

    const b_intxn_feature_collection = turf.featureCollection(
      a_and_b_tmcs.map((tmc) => layer_b_features_by_tmc[tmc])
    );

    const b_intxn_layer_id = `${layer_id}::b_intxn`;

    try {
      map.removeLayer(b_intxn_layer_id);
      map.removeSource(b_intxn_layer_id);
    } catch (err) {}

    map.addSource(b_intxn_layer_id, {
      type: "geojson",
      data: b_intxn_feature_collection,
    });

    map.addLayer({
      id: b_intxn_layer_id,
      type: "line",
      source: b_intxn_layer_id,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#f3f700",
        "line-width": 1,
        // "line-offset": layer_offset * 2,
      },
    });

    const intxn_polygons = a_and_b_tmcs.map((tmc) =>
      getPolygon([layer_a_features_by_tmc[tmc], layer_b_features_by_tmc[tmc]])
    );

    const intxn_polygons_feature_collection =
      turf.featureCollection(intxn_polygons);

    const inxtn_polygons_source_id = `${layer_id}::intxn_polygons`;
    const inxtn_polygons_fill_id = `${inxtn_polygons_source_id}::fill`;
    const inxtn_polygons_outline_id = `${inxtn_polygons_source_id}::outline`;

    try {
      map.removeLayer(inxtn_polygons_fill_id);
      map.removeLayer(inxtn_polygons_outline_id);
      map.removeSource(inxtn_polygons_source_id);
    } catch (err) {}

    map.addSource(inxtn_polygons_source_id, {
      type: "geojson",
      data: intxn_polygons_feature_collection,
    });

    map.addLayer({
      id: inxtn_polygons_fill_id,
      type: "fill",
      source: inxtn_polygons_source_id,
      layout: {},
      paint: {
        "fill-color": "#f3f700",
        "fill-opacity": 0.5,
        // "line-offset": layer_offset * 2,
      },
    });

    map.addLayer({
      id: inxtn_polygons_outline_id,
      type: "line",
      source: inxtn_polygons_source_id,
      layout: {},
      paint: {
        "line-color": "#f3f700",
        "line-width": 1,
        // "line-offset": layer_offset * 2,
      },
    });

    // A - B
    const a_only_tmcs = _.difference(a_tmcs, b_tmcs);

    const a_only_feature_collection = turf.featureCollection(
      a_only_tmcs.map((tmc) => layer_a_features_by_tmc[tmc])
    );

    const a_only_layer_id = `${layer_id}::a_only`;

    try {
      map.removeLayer(a_only_layer_id);
      map.removeSource(a_only_layer_id);
    } catch (err) {}

    map.addSource(a_only_layer_id, {
      type: "geojson",
      data: a_only_feature_collection,
    });

    map.addLayer({
      id: a_only_layer_id,
      type: "line",
      source: a_only_layer_id,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#ff0000",
        "line-width": 3,
        // "line-offset": layer_offset,
      },
    });

    // B - A
    const b_only_tmcs = _.difference(b_tmcs, a_tmcs);

    const b_only_feature_collection = turf.featureCollection(
      b_only_tmcs.map((tmc) => layer_b_features_by_tmc[tmc])
    );

    const b_only_layer_id = `${layer_id}::b_only`;

    try {
      map.removeLayer(b_only_layer_id);
      map.removeSource(b_only_layer_id);
    } catch (err) {}

    map.addSource(b_only_layer_id, {
      type: "geojson",
      data: b_only_feature_collection,
    });

    map.addLayer({
      id: b_only_layer_id,
      type: "line",
      source: b_only_layer_id,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#7d7aff",
        "line-width": 3,
        // "line-offset": layer_offset * 2,
      },
    });
  }

  const map_candidates = Object.values(cells).filter((cell_state) => {
    const is_map_cell =
      cell_state instanceof AbstractMapCellState &&
      !(cell_state instanceof MapYearCellState);

    const is_not_self = cell_state.cell_id !== this_cell_id;
    const is_not_dependent = !cell_state.dependencies?.includes(this_cell_id);

    return is_map_cell && is_not_self && is_not_dependent;
  });

  const candidate_id_name_pairs = map_candidates
    .map((cell_state) => [cell_state.cell_id, cell_state.name])
    .sort((a, b) => +a[0] - +b[0]);

  const dep_map_menu_items = candidate_id_name_pairs.map(
    ([cell_id, cell_name]) => (
      <MenuItem key={`cell_${cell_id}`} value={cell_id}>
        {cell_name}
      </MenuItem>
    )
  );

  const RenderButton = (
    <Button variant="contained" color="success" onClick={fetchTmcs}>
      Render
    </Button>
  );

  return (
    <Box key={layer_id} style={{ paddingBottom: 10 }}>
      <Card sx={{ minWidth: 275 }}>
        <CardContent>
          <FormControl sx={{ m: 1, minWidth: 300 }}>
            <InputLabel id="demo-simple-select-label">
              Dependency Map A
            </InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={`${layer_dependency_id_a}`}
              label="Dependency Map"
              onChange={(event: SelectChangeEvent) => {
                const selected_cell_id = +event.target.value;
                console.log("LayerForm =>", selected_cell_id);
                dispatchLayerDependencyAChange(selected_cell_id);
              }}
            >
              {dep_map_menu_items}
            </Select>
            <FormHelperText>
              <span style={{ color: "#FF3131" }}>Map A</span>
            </FormHelperText>
          </FormControl>

          <FormControl sx={{ m: 1, minWidth: 300 }}>
            <InputLabel id="demo-simple-select-label">
              Dependency Map B
            </InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={`${layer_dependency_id_b}`}
              label="Dependency Map"
              onChange={(event: SelectChangeEvent) => {
                const selected_cell_id = +event.target.value;
                console.log("LayerForm =>", selected_cell_id);
                dispatchLayerDependencyBChange(selected_cell_id);
              }}
            >
              {dep_map_menu_items}
            </Select>
            <FormHelperText>
              <span style={{ color: "#00FA9A" }}>Map B</span>
            </FormHelperText>
          </FormControl>

          <FormControl sx={{ m: 1, minWidth: 100 }}>
            <TextField
              required
              id="outlined-required"
              value={layer_offset}
              onChange={({ target: { value } }) => {
                // @ts-ignore
                dispatchLayerOffsetChange(value);
              }}
            />
            <FormHelperText>Lines Offset (feet)</FormHelperText>
          </FormControl>
          {RenderButton}
        </CardContent>
      </Card>
    </Box>
  );
}
