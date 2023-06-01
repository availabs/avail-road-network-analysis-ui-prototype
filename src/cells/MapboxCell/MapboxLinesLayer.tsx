import { useContext, useEffect } from "react";

import { produce, Draft } from "immer";
import _ from "lodash";
import { Map } from "mapbox-gl"; // eslint-disable-line import/no-webpack-loader-syntax

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

export function mapboxLinesLayersReducer(
  cell: MapboxLinesLayerState,
  action: CellAction
) {
  cell = abstractMapCellReducer(cell, action) as MapboxLinesLayerState;

  const { type, payload } = action;

  if (type === CellActionType.ADD_LAYER) {
    console.log("==> CellActionType.ADD_LAYER");
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

export class MapboxLinesLayerState extends AbstractCellState {
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

export function MapboxLinesLayerForm({
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

  const { cells } = useContext(CellsContext);

  const this_cell = cells[this_cell_id];

  useEffect(() => {
    if (!map) {
      return;
    }

    map.setLayoutProperty(
      layer_id,
      "visibility",
      layer_visible ? "visible" : "none"
    );
  }, [map, layer_visible, layer_id]);

  if (!this_cell) {
    return null;
  }

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

    console.log(dependency_cells_meta);

    const response = await fetch(
      `${API_URL}/data-types/npmrds/network-analysis/getTmcFeatures`,
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

    const feature_collection = await response.json();

    try {
      map.removeLayer(layer_id);
      map.removeSource(layer_id);
    } catch (err) {}

    map.addSource(layer_id, {
      type: "geojson",
      data: feature_collection,
    });

    map.addLayer({
      id: layer_id,
      type: "line",
      source: layer_id,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": line_color,
        "line-width": +line_width,
        "line-offset": +line_offset,
      },
    });

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
                console.log("LayerForm =>", selected_cell_id);
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
                      console.log(line_color);
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
