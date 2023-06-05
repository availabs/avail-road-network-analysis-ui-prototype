import { useContext, useEffect, useState } from "react";

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

import { HuePicker } from "react-color";

import getTmcFeatures from "../../api/getTmcFeatures";

import AbstractCellState, {
  reducer as abstractMapCellReducer,
} from "../AbstractMapCellState";

import AbstractMapCellState from "../AbstractMapCellState";
import { MapYearCellState } from "../MapYearCell";

import { CellID, CellType } from "../domain";

import CellsContext from "../CellsContext";

import { API_URL } from "../../config/api";

export type LayerID = string;

export type LayerMeta = {
  layer_id: LayerID;
  layer_dependency_id: CellID | null;
  layer_style: {
    line_color: string;
    line_width: number;
    line_offset: number;
  };
  layer_visible: boolean;
};

const layer_initial_style: LayerMeta["layer_style"] = {
  line_color: "#199781",
  line_width: 3,
  line_offset: 1,
};

export enum CellActionType {
  ADD_LAYER = "ADD_LAYER",

  SET_LAYER_DEPENDENCY = "SET_LAYER_DEPENDENCY",
  SET_LAYER_COLOR = "SET_LAYER_COLOR",
  SET_LAYER_LINE_WIDTH = "SET_LAYER_LINE_WIDTH",
  SET_LAYER_LINE_OFFSET = "SET_LAYER_LINE_OFFSET",
  TOGGLE_LAYER_VISIBILITY = "TOGGLE_LAYER_VISIBILITY",
}

export type CellAction = {
  type: CellActionType;
  payload: any;
};

function getSourceAndLayerNames(layer_id: LayerID) {
  const lines = `${layer_id}::lines`;
  const points = `${layer_id}::points`;

  return {
    sources: {
      lines: `${lines}::source`,
      points: `${points}::source`,
    },
    layers: {
      lines: `${lines}::layer`,
      points: `${points}::layer`,
    },
  };
}

export function mapboxNetworkFlowLayersReducer(
  cell: MapboxNetworkFlowLayerState,
  action: CellAction
) {
  cell = abstractMapCellReducer(cell, action) as MapboxNetworkFlowLayerState;

  const { type, payload } = action;

  if (type === CellActionType.ADD_LAYER) {
    return cell.addLayer(payload);
  }

  if (type === CellActionType.SET_LAYER_DEPENDENCY) {
    const { layer_id, layer_dependency_id } = payload;
    return cell.setLayerDependency(layer_id, layer_dependency_id);
  }

  if (type === CellActionType.SET_LAYER_COLOR) {
    const { layer_id, line_color } = payload;
    return cell.setColor(layer_id, line_color);
  }

  if (type === CellActionType.SET_LAYER_LINE_WIDTH) {
    const { layer_id, line_width } = payload;
    return cell.setLineWidth(layer_id, line_width);
  }

  if (type === CellActionType.SET_LAYER_LINE_OFFSET) {
    const { layer_id, line_offset } = payload;
    return cell.setLineOffset(layer_id, line_offset);
  }

  if (type === CellActionType.TOGGLE_LAYER_VISIBILITY) {
    const { layer_id } = payload;
    return cell.toggleLayerVisibility(layer_id);
  }

  return cell;
}

export class MapboxNetworkFlowLayerState extends AbstractCellState {
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
      this.descriptor.layers
        .map(({ layer_dependency_id }) => layer_dependency_id)
        .filter(Boolean)
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

      console.log("\n\n===> MapboxNetworkFlowLayer addLayer\n\n");

      draft._descriptor.layers.push({
        layer_id,
        layer_dependency_id: null,
        layer_style: layer_initial_style,
        layer_visible: true,
      });
    });
  }

  setDependencies(cell_id: CellID[]): this {
    return super.setDependencies(cell_id);
  }

  setLayerDependency(layer_id: LayerID, layer_dependency_id: CellID) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_dependency_id = layer_dependency_id;
    });
  }

  setColor(layer_id: LayerID, line_color: string) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_style.line_color = line_color;
    });
  }

  setLineWidth(layer_id: LayerID, line_width: number) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_style.line_width = line_width;
    });
  }

  setLineOffset(layer_id: LayerID, line_offset: number) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_style.line_offset = line_offset;
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

export function MapboxNetworkFlowLayerForm({
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
    layer_style: { line_color, line_width, line_offset },
    layer_dependency_id,
    layer_visible,
  } = layer_meta;

  const [points_animation_interval, setPointsAnimationInterval] =
    useState(null);

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

  console.log("\n\n===== 1 =====\n\n");
  if (!this_cell) {
    return null;
  }
  console.log("\n\n===== 2 =====\n\n");

  const dispatchDependencyChange = (layer_dependency_id: number) =>
    dispatch({
      type: CellActionType.SET_LAYER_DEPENDENCY,
      payload: {
        layer_id,
        layer_dependency_id,
      },
    });

  const dispatchColorChange = (line_color: string) =>
    dispatch({
      type: CellActionType.SET_LAYER_COLOR,
      payload: {
        layer_id,
        line_color,
      },
    });

  const dispatchLineWidthChange = (line_width: number) =>
    dispatch({
      type: CellActionType.SET_LAYER_LINE_WIDTH,
      payload: {
        layer_id,
        line_width,
      },
    });

  const dispatchLineOffsetChange = (line_offset: number) =>
    dispatch({
      type: CellActionType.SET_LAYER_LINE_OFFSET,
      payload: {
        layer_id,
        line_offset,
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
    console.log("\n\nFETCH TMCS\n\n");
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

    const response = await fetch(
      `${API_URL}/data-types/npmrds/network-analysis/getTmcs`,
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

    const tmcs = await response.json();

    const line_features = (await getTmcFeatures(year, tmcs)).map((feature) =>
      turf.lineOffset(feature, +line_offset / 3, {
        units: "yards",
      })
    );

    const names = getSourceAndLayerNames(layer_id);

    for (const layer_id of Object.values(names.layers)) {
      try {
        map.removeLayer(layer_id);
        // map.off("mousemove", layer_id, updateHoveredTmc);
        // map.off("mouseleave", layer_id, updateHoveredTmc);
      } catch (err) {}
    }

    for (const source_id of Object.values(names.sources)) {
      try {
        map.removeSource(source_id);
      } catch (err) {}
    }

    const lines_feature_collection = turf.featureCollection(line_features);

    map.addSource(names.sources.lines, {
      type: "geojson",
      data: lines_feature_collection,
    });

    // NORMALIZE AADT/mile
    //    It would be great to represent AADT as points per mile.
    //    High traffic roads would have more points per mile.

    map.addLayer({
      id: names.layers.lines,
      type: "line",
      source: names.sources.lines,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": line_color,
        // "line-width": 3,
        // "line-offset": layer_offset,
      },
    });

    // @ts-ignore
    clearInterval(points_animation_interval);

    const point_features = _.flattenDeep(
      Object.values(line_features).map((feature) =>
        // Start point. NOTE: TMCs are MultiLineStrings. Geometries are Position[][].
        feature.geometry.coordinates.map((line_coords) => {
          const line = turf.lineString(line_coords);
          const chunked = turf.lineChunk(line, 0.05, { units: "miles" });
          return chunked.features.map((line) =>
            turf.point(turf.getCoords(turf.getCoords(line))[0])
          );
        })
      )
    );

    const points_feature_collection = turf.featureCollection(
      point_features
    ) as turf.FeatureCollection<turf.Point>;

    console.log({ point_features });

    map.addSource(names.sources.points, {
      type: "geojson",
      data: points_feature_collection,
    });

    map.addLayer({
      id: names.layers.points,
      type: "circle",
      source: names.sources.points,
      paint: {
        "circle-radius": {
          base: 1.75,
          stops: [
            [12, 2],
            [22, 60],
          ],
        },
        "circle-color": line_color,
      },
    });

    let step = 0;
    const new_pts_animation_interval = setInterval(() => {
      const pts = _.flattenDeep(
        Object.values(line_features).map((feature) =>
          // Start point. NOTE: TMCs are MultiLineStrings. Geometries are Position[][].
          feature.geometry.coordinates.map((line_coords) => {
            const line = turf.lineString(line_coords);
            const line_len = turf.length(line, { units: "miles" });
            const line_slice = turf.lineSliceAlong(
              line,
              Math.min((step % 10) * 0.01, line_len),
              line_len,
              { units: "miles" }
            );

            const chunked = turf.lineChunk(line_slice, 0.05, {
              units: "miles",
            });

            return chunked.features.map((line) =>
              turf.point(turf.getCoords(turf.getCoords(line))[0])
            );
          })
        )
      );

      const pts_feature_collection = turf.featureCollection(pts);

      requestAnimationFrame(() =>
        // @ts-ignore
        map.getSource(names.sources.points).setData(pts_feature_collection)
      );

      ++step;
    }, 200);

    // @ts-ignore
    setPointsAnimationInterval(new_pts_animation_interval as Timer);

    if (!layer_visible) {
      dispatchToggleLayerVisibility();
    }
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
              Dependency Map
            </InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={`${layer_dependency_id}`}
              label="Dependency Map"
              onChange={(event: SelectChangeEvent) => {
                const selected_cell_id = +event.target.value;
                dispatchDependencyChange(selected_cell_id);
              }}
            >
              {dep_map_menu_items}
            </Select>
            <FormHelperText>The map to filter.</FormHelperText>
          </FormControl>
          <FormControl sx={{ m: 1, minWidth: 300 }}>
            <Box>
              <Card sx={{ minWidth: 275 }}>
                <CardContent>
                  <HuePicker
                    color={line_color}
                    onChangeComplete={(color) => {
                      dispatchColorChange(color.hex);
                    }}
                  />
                </CardContent>
              </Card>
            </Box>
            <FormHelperText>Line Color</FormHelperText>
          </FormControl>
          <FormControl sx={{ m: 1, minWidth: 100 }}>
            <TextField
              required
              id="outlined-required"
              value={line_width}
              onChange={({ target: { value } }) => {
                // @ts-ignore
                dispatchLineWidthChange(value);
              }}
            />
            <FormHelperText>Line Width</FormHelperText>
          </FormControl>
          <FormControl sx={{ m: 1, minWidth: 100 }}>
            <TextField
              required
              id="outlined-required"
              value={line_offset}
              onChange={({ target: { value } }) => {
                // @ts-ignore
                dispatchLineOffsetChange(value);
              }}
            />
            <FormHelperText>Line Offset</FormHelperText>
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
