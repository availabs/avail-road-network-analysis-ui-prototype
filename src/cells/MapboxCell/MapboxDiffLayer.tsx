import { useContext, useEffect } from "react";

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

import { API_URL } from "../../config/api";
import getTmcFeatures from "../../api/getTmcFeatures";

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

  TOGGLE_LAYER_VISIBILITY = "TOGGLE_LAYER_VISIBILITY",
}

export type CellAction = {
  type: CellActionType;
  payload: any;
};

type TmcFeature = turf.Feature<turf.MultiLineString, turf.Properties>;

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

export function mapboxDiffLayersReducer(
  cell: MapboxDiffLayerState,
  action: CellAction
) {
  cell = abstractMapCellReducer(cell, action) as MapboxDiffLayerState;

  const { type, payload } = action;

  if (type === CellActionType.ADD_LAYER) {
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

  if (type === CellActionType.TOGGLE_LAYER_VISIBILITY) {
    const { layer_id } = payload;
    return cell.toggleLayerVisibility(layer_id);
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

  toggleLayerVisibility(layer_id: LayerID) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_visible = !layer_meta!.layer_visible;
    });
  }
}

function getSourceAndLayerNames(layer_id: LayerID) {
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

export function MapboxDiffLayerForm({
  this_cell_id,
  layer_meta,
  dispatch,
  map,
  hovered_tmc,
  setHoveredTmc,
}: {
  this_cell_id: CellID;
  layer_meta: LayerMeta;
  dispatch: (action: CellAction) => void;
  map: Map;
  hovered_tmc: string | null;
  setHoveredTmc: (tmc: string | null) => void;
}) {
  const {
    layer_id,
    layer_dependency_id_a,
    layer_dependency_id_b,
    layer_offset,
    layer_visible,
  } = layer_meta;

  const now = new Date();
  console.log(now);

  const { cells } = useContext(CellsContext);

  const this_cell = cells[this_cell_id];

  useEffect(() => {
    if (!map) {
      return;
    }

    const { layers } = getSourceAndLayerNames(layer_id);

    for (const layer_id of Object.values(layers)) {
      try {
        map.setLayoutProperty(
          layer_id,
          "visibility",
          layer_visible ? "visible" : "none"
        );
      } catch (err) {}
    }
  }, [map, layer_visible, layer_id]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const { layers } = getSourceAndLayerNames(layer_id);

    const filter = hovered_tmc
      ? ["match", ["get", "tmc"], [hovered_tmc], true, false]
      : null;

    for (const layer_id of Object.values(layers)) {
      try {
        map.setFilter(layer_id, filter);
      } catch (err) {}
    }
  }, [map, hovered_tmc, layer_id]);

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

  const dispatchToggleLayerVisibility = () =>
    dispatch({
      type: CellActionType.TOGGLE_LAYER_VISIBILITY,
      payload: {
        layer_id,
      },
    });

  async function fetchTmcs() {
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

    function updateHoveredTmc(e: any) {
      console.log(now);
      const tmc = (e && e.features && e.features?.[0]?.properties?.tmc) || null;

      console.log("==> tmc", tmc);

      if (tmc !== hovered_tmc) {
        console.log("Updating hovered TMC from", hovered_tmc, "to", tmc);
        setHoveredTmc(tmc);
      } else if (tmc === null && hovered_tmc !== null) {
        console.log("Updating hovered TMC from", hovered_tmc, "to", tmc);
        setHoveredTmc(null);
      }
    }

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

    const names = getSourceAndLayerNames(layer_id);

    for (const layer_id of Object.values(names.layers)) {
      try {
        map.removeLayer(layer_id);
        map.off("mousemove", layer_id, updateHoveredTmc);
        map.off("mouseleave", layer_id, updateHoveredTmc);
      } catch (err) {}
    }

    for (const source_id of Object.values(names.sources)) {
      try {
        map.removeSource(source_id);
      } catch (err) {}
    }

    const a_tmcs = Object.keys(layer_a_features_by_tmc);
    const b_tmcs = Object.keys(layer_b_features_by_tmc);

    // A ∩ B
    const a_and_b_tmcs = _.intersection(a_tmcs, b_tmcs);

    const intxn_polygons = a_and_b_tmcs.map((tmc) =>
      getPolygons([layer_a_features_by_tmc[tmc], layer_b_features_by_tmc[tmc]])
    );

    const intxn_polygons_feature_collection = turf.featureCollection(
      _.flatten(intxn_polygons)
    );

    // try {
    // map.removeLayer(names.layers.inxtn_polygons_fill);
    // // map.removeLayer(names.layers.inxtn_polygons_outline);
    // map.removeSource(names.sources.inxtn_polygons);
    // } catch (err) {}

    map.addSource(names.sources.inxtn_polygons, {
      type: "geojson",
      data: intxn_polygons_feature_collection,
    });

    map.addLayer({
      id: names.layers.inxtn_polygons_fill,
      type: "fill",
      source: names.sources.inxtn_polygons,
      layout: {},
      paint: {
        "fill-color": "#f3f700",
        "fill-opacity": 0.5,
        // "line-offset": layer_offset * 2,
      },
    });

    // map.addLayer({
    // id: names.layers.inxtn_polygons_outline,
    // type: "line",
    // source: names.sources.inxtn_polygons,
    // layout: {},
    // paint: {
    // // "line-color": "#000000",
    // "line-color": "#f3f700",
    // "line-width": 1,
    // // "line-offset": layer_offset * 2,
    // },
    // });

    const a_intxn_feature_collection = turf.featureCollection(
      a_and_b_tmcs.map((tmc) => layer_a_features_by_tmc[tmc])
    );

    map.addSource(names.sources.a_intxn, {
      type: "geojson",
      data: a_intxn_feature_collection,
    });

    // https://stackoverflow.com/a/49924026
    map.addLayer({
      id: names.layers.a_intxn,
      type: "line",
      source: names.sources.a_intxn,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#f3f700",
        "line-width": 3,
        "line-dasharray": [6, 3],
      },
    });

    const b_intxn_feature_collection = turf.featureCollection(
      a_and_b_tmcs.map((tmc) => layer_b_features_by_tmc[tmc])
    );

    try {
      map.removeLayer(names.layers.b_intxn);
      map.removeSource(names.sources.b_intxn);
    } catch (err) {}

    map.addSource(names.sources.b_intxn, {
      type: "geojson",
      data: b_intxn_feature_collection,
    });

    map.addLayer({
      id: names.layers.b_intxn,
      type: "line",
      source: names.sources.b_intxn,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#f3f700",
        "line-width": 3,
        "line-dasharray": [2, 2],
      },
    });

    // A - B
    const a_only_tmcs = _.difference(a_tmcs, b_tmcs);

    const a_only_feature_collection = turf.featureCollection(
      a_only_tmcs.map((tmc) => layer_a_features_by_tmc[tmc])
    );

    try {
      map.removeLayer(names.layers.a_only);
      map.removeSource(names.sources.a_only);
    } catch (err) {}

    map.addSource(names.sources.a_only, {
      type: "geojson",
      data: a_only_feature_collection,
    });

    map.addLayer({
      id: names.layers.a_only,
      type: "line",
      source: names.sources.a_only,
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

    try {
      map.removeLayer(names.layers.b_only);
      map.removeSource(names.sources.b_only);
    } catch (err) {}

    map.addSource(names.sources.b_only, {
      type: "geojson",
      data: b_only_feature_collection,
    });

    map.addLayer({
      id: names.layers.b_only,
      type: "line",
      source: names.sources.b_only,
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

    if (!layer_visible) {
      dispatchToggleLayerVisibility();
    }

    map.on("mousemove", Object.values(names.layers), updateHoveredTmc);
    map.on("mouseleave", Object.values(names.layers), updateHoveredTmc);
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
          <span style={{ padding: 10 }}>
            <Button variant="contained" color="success" onClick={fetchTmcs}>
              Render
            </Button>
          </span>
          <Button
            variant="contained"
            color="success"
            onClick={dispatchToggleLayerVisibility}
          >
            {layer_visible ? "Hide" : "Show"}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
