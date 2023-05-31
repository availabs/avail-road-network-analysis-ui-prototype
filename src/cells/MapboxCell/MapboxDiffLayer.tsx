import { useContext } from "react";

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

          const feature_collection = await response.json();

          return feature_collection;
        }
      )
    );

    const layer_id_a = `${layer_id}_a`;

    try {
      map.removeLayer(layer_id_a);
      map.removeSource(layer_id_a);
    } catch (err) {}

    map.addSource(layer_id_a, {
      type: "geojson",
      data: feature_collections[0],
    });

    map.addLayer({
      id: layer_id_a,
      type: "line",
      source: layer_id_a,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#FF3131",
        "line-width": 1,
        "line-offset": +layer_offset,
      },
    });

    const layer_id_b = `${layer_id}_b`;

    try {
      map.removeLayer(layer_id_b);
      map.removeSource(layer_id_b);
    } catch (err) {}

    map.addSource(layer_id_b, {
      type: "geojson",
      data: feature_collections[0],
    });

    map.addLayer({
      id: layer_id_b,
      type: "line",
      source: layer_id_b,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#00FA9A",
        "line-width": 1,
        "line-offset": +layer_offset * 2,
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
            <FormHelperText>Map A</FormHelperText>
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
            <FormHelperText>Map B</FormHelperText>
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
            <FormHelperText>Lines Offset</FormHelperText>
          </FormControl>
          {RenderButton}
        </CardContent>
      </Card>
    </Box>
  );
}
