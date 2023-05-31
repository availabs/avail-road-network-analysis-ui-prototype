import { useContext, useRef, useEffect, useReducer } from "react";

import { produce, Draft } from "immer";

import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";

import { HuePicker } from "react-color";

import mapboxgl, { Map } from "mapbox-gl"; // eslint-disable-line import/no-webpack-loader-syntax
import _ from "lodash";

import mapbox_token from "../../config/mapbox_token";

import AbstractCellState, {
  reducer as abstractMapCellReducer,
} from "../AbstractMapCellState";

import AbstractMapCellState from "../AbstractMapCellState";

import { MapYearCellState } from "../MapYearCell";

import { CellID, CellType } from "../domain";
import CellsContext from "../CellsContext";

mapboxgl.accessToken = mapbox_token;

const map_initial_state = {
  lng: -73.823969,
  lat: 42.686155,
  zoom: 9,
};

enum CellActionType {
  SET_NAME = "SET_NAME",
  SET_DEPENDENCY = "SET_DEPENDENCY",
  UPSERT_LAYER = "UPSERT_LAYER",

  SET_COLOR = "SET_COLOR",
  SET_LINE_WIDTH = "SET_LINE_WIDTH",
  SET_LINE_OFFSET = "SET_LINE_OFFSET",
}

type CellAction = {
  type: CellActionType;
  payload: any;
};

export function reducer(cell: MapboxCellState, action: CellAction) {
  cell = abstractMapCellReducer(cell, action) as MapboxCellState;

  const { type, payload } = action;

  if (type === CellActionType.SET_NAME) {
    return cell.setName(payload);
  }

  if (type === CellActionType.SET_DEPENDENCY) {
    return cell.setDependencies(payload);
  }

  if (type === CellActionType.UPSERT_LAYER) {
    return cell.upsertLayer(payload);
  }

  if (type === CellActionType.SET_COLOR) {
    return cell.setColor(payload);
  }

  if (type === CellActionType.SET_LINE_WIDTH) {
    return cell.setLineWidth(payload);
  }

  if (type === CellActionType.SET_LINE_OFFSET) {
    return cell.setLineOffset(payload);
  }

  return cell;
}

type LayerMeta = {
  layer_id: string;
  layer_style: object;
  layer_geojson: object;
};

class MapboxCellState extends AbstractCellState {
  readonly dependencies: CellID[] | null;
  readonly _descriptor: Record<string, LayerMeta>;
  readonly line_color: string;
  readonly line_width: number;
  readonly line_offset: number;

  constructor() {
    super(CellType.MapboxCell);
    this.dependencies = null;

    // @ts-ignore
    this._descriptor = {}; // put the layers and their styling here

    this.line_color = "#199781";
    this.line_width = 3;
    this.line_offset = 1;
  }

  get descriptor() {
    return this._descriptor;
  }

  get is_ready() {
    return !!this.dependencies?.length;
  }

  setDependencies(cell_id: [CellID]): this {
    return super.setDependencies(cell_id);
  }

  upsertLayer(layer_meta: LayerMeta): this {
    const { layer_id, layer_style, layer_geojson } = layer_meta;

    return produce(this, (draft: Draft<this>) => {
      if (!this._descriptor[layer_id]) {
        // @ts-ignore
        draft._descriptor[layer_id] = { layer_id };
      }

      draft._descriptor[layer_id].layer_style = layer_style;
      draft._descriptor[layer_id].layer_geojson = layer_geojson;
    });
  }

  setColor(line_color: string) {
    return produce(this, (draft: Draft<this>) => {
      draft.line_color = line_color;
    });
  }

  setLineWidth(line_width: number) {
    return produce(this, (draft: Draft<this>) => {
      draft.line_width = line_width;
    });
  }

  setLineOffset(line_offset: number) {
    return produce(this, (draft: Draft<this>) => {
      draft.line_offset = line_offset;
    });
  }

  get dependency_cell_id() {
    return this.dependencies?.[0] || null;
  }
}

function CellForm({
  this_cell_id,
  dispatchDependencyChange,
  is_ready,
  fetchTmcs,
  line_color,
  dispatchColorChange,
  line_width,
  dispatchLineWidthChange,
  line_offset,
  dispatchLineOffsetChange,
}: {
  this_cell_id: CellID;
  dispatchDependencyChange: (cell_id: CellID) => void;
  fetchTmcs: () => Promise<void>;
  is_ready: boolean;
  line_color: string;
  dispatchColorChange: (line_color: string) => void;
  line_width: number;
  dispatchLineWidthChange: (line_width: number) => void;
  line_offset: number;
  dispatchLineOffsetChange: (line_width: number) => void;
}) {
  const { cells } = useContext(CellsContext);

  const this_cell = cells[this_cell_id];

  if (!this_cell) {
    return null;
  }

  console.log({ this_cell_id, cells });

  const candidates = Object.values(cells).filter((cell_state) => {
    const is_map_cell =
      cell_state instanceof AbstractMapCellState &&
      !(cell_state instanceof MapYearCellState);
    const is_not_self = cell_state.cell_id !== this_cell_id;
    const is_not_dependent = !cell_state.dependencies?.includes(this_cell_id);

    return is_map_cell && is_not_self && is_not_dependent;
  });

  const [current_dependency_id = null] = cells[this_cell_id].dependencies || [];

  const candidate_id_name_pairs = candidates
    .map((cell_state) => [cell_state.cell_id, cell_state.name])
    .sort((a, b) => +a[0] - +b[0]);

  const dep_map_menu_items = candidate_id_name_pairs.map(
    ([cell_id, cell_name]) => (
      <MenuItem key={`cell_${cell_id}`} value={cell_id}>
        {cell_name}
      </MenuItem>
    )
  );

  const RenderButton = is_ready ? (
    <Button variant="contained" color="success" onClick={fetchTmcs}>
      Render Map
    </Button>
  ) : (
    ""
  );

  return (
    <div>
      <FormControl sx={{ m: 1, minWidth: 300 }}>
        <InputLabel id="demo-simple-select-label">Dependency Map</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={`${current_dependency_id}`}
          label="Dependency Map"
          onChange={(event: SelectChangeEvent) => {
            const selected_cell_id = +event.target.value;
            console.log("CellForm =>", selected_cell_id);
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
      {RenderButton}
    </div>
  );
}

// https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/
export default function MapboxCell() {
  const mapContainer = useRef(null);
  const map: { current: Map | null } = useRef(null);

  // CONSIDER: Cells pass their Maps their state through props.
  // That way, cells control state via dispatch.
  const [state, dispatch] = useReducer(reducer, new MapboxCellState());

  const { cells, updateCellState } = useContext(CellsContext);

  useEffect(() => {
    updateCellState(state);
  }, [state, updateCellState]);

  const { cell_id, cell_type, line_color, line_width, line_offset } = state;

  const dispatchDependencyChange = (cell_id: number) =>
    dispatch({
      type: CellActionType.SET_DEPENDENCY,
      payload: cell_id,
    });

  const dispatchColorChange = (line_color: string) =>
    dispatch({
      type: CellActionType.SET_COLOR,
      payload: line_color,
    });

  const dispatchLineWidthChange = (line_width: number) =>
    dispatch({
      type: CellActionType.SET_LINE_WIDTH,
      payload: line_width,
    });

  const dispatchLineOffsetChange = (line_offset: number) =>
    dispatch({
      type: CellActionType.SET_LINE_OFFSET,
      payload: line_offset,
    });

  async function fetchTmcShapes() {
    console.log("FETCH TMCS");

    const { dependencies } = state;

    const dependency_cells_meta = dependencies!.map(
      (cell_id) => cells[cell_id].meta
    );

    const seen_cell_ids = new Set(dependencies);
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

    const response = await fetch(
      "http://127.0.0.1:3369/dama-admin/dama_dev_1/data-types/npmrds/network-analysis/getTmcFeatures",
      {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dependency: dependencies![0],
          dependency_cells_meta,
        }), // body data type must match "Content-Type" header
      }
    );

    // console.log("==> response.status", response.status);
    // console.log("==> response.status", response.body);

    const feature_collection = await response.json();

    try {
      map.current?.removeLayer("tmcs-layer");
      map.current?.removeSource("tmcs");
    } catch (err) {}

    map.current?.addSource("tmcs", {
      type: "geojson",
      data: feature_collection,
    });

    map.current?.addLayer({
      id: "tmcs-layer",
      type: "line",
      source: "tmcs",
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
  }

  const { is_ready } = state;

  useEffect(() => {
    console.log({ is_ready, map: map.current });

    if (!is_ready || map.current) {
      // initialize map only once
      return;
    }

    console.log("==> INITIALIZING MAP");

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      // https://www.mapbox.com/maps/dark
      style: "mapbox://styles/mapbox/dark-v11",
      center: [map_initial_state.lng, map_initial_state.lat],
      zoom: map_initial_state.zoom,
    }) as Map;
  }, [is_ready]);

  console.log("FOO");

  // The links at the bottom of the map: https://docs.mapbox.com/help/getting-started/attribution/
  return (
    <div>
      <Typography variant="h4" gutterBottom>
        {cell_type}
      </Typography>
      <CellForm
        this_cell_id={cell_id}
        dispatchDependencyChange={dispatchDependencyChange}
        is_ready={is_ready}
        fetchTmcs={fetchTmcShapes}
        line_color={line_color}
        dispatchColorChange={dispatchColorChange}
        line_width={line_width}
        dispatchLineWidthChange={dispatchLineWidthChange}
        line_offset={line_offset}
        dispatchLineOffsetChange={dispatchLineOffsetChange}
      />
      <div
        style={{ height: "750px" }}
        ref={mapContainer}
        className="map-container"
      />
    </div>
  );
}
