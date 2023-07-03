import { useContext, useRef, useEffect, useReducer } from "react";

import { v4 as uuid } from "uuid";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import mapboxgl, { Map } from "mapbox-gl"; // eslint-disable-line import/no-webpack-loader-syntax

import mapbox_token from "../../config/mapbox_token";

import CellsContext from "../CellsContext";

import {
  MapboxLinesLayerState,
  MapboxLinesLayerForm,
  mapboxLinesLayersReducer,
  CellActionType as LinesLayerCellActionType,
} from "./MapboxLinesLayer";

import {
  MapboxDiffLayerState,
  MapboxDiffLayerForm,
  mapboxDiffLayersReducer,
  CellActionType as DiffLayerCellActionType,
} from "./MapboxDiffLayer";

import {
  MapboxNetworkFlowLayerState,
  MapboxNetworkFlowLayerForm,
  mapboxNetworkFlowLayersReducer,
  CellActionType as NetworkFlowLayerCellActionType,
} from "./MapboxNetworkFlowLayer";

mapboxgl.accessToken = mapbox_token;

const map_initial_state = {
  lng: -73.823969,
  lat: 42.686155,
  zoom: 9,
};

// https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/
export default function MapboxCell() {
  const mapContainer = useRef(null);
  const map: { current: Map | null } = useRef(null);

  // CONSIDER: Cells pass their Maps their state through props.
  // That way, cells control state via linesLayerDispatch.
  const [lines_layers_state, linesLayerDispatch] = useReducer(
    mapboxLinesLayersReducer,
    new MapboxLinesLayerState()
  );

  const [diff_layers_state, diffLayerDispatch] = useReducer(
    mapboxDiffLayersReducer,
    new MapboxDiffLayerState()
  );

  const [network_flow_layers_state, networkFlowLayerDispatch] = useReducer(
    mapboxNetworkFlowLayersReducer,
    new MapboxNetworkFlowLayerState()
  );

  const { updateCellState } = useContext(CellsContext);

  useEffect(() => {
    updateCellState(lines_layers_state);
    updateCellState(diff_layers_state);
    updateCellState(network_flow_layers_state);
  }, [
    lines_layers_state,
    diff_layers_state,
    network_flow_layers_state,
    updateCellState,
  ]);

  const {
    cell_id: lines_cell_id,
    descriptor: { layers: lines_layers },
  } = lines_layers_state;

  const {
    cell_id: diffs_cell_id,
    descriptor: { layers: diff_layers },
  } = diff_layers_state;

  const {
    cell_id: network_flow_cell_id,
    descriptor: { layers: network_flow_layers },
  } = network_flow_layers_state;

  useEffect(() => {
    if (map.current) {
      // initialize map only once
      return;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      // https://www.mapbox.com/maps/dark
      style: "mapbox://styles/mapbox/dark-v11",
      center: [map_initial_state.lng, map_initial_state.lat],
      zoom: map_initial_state.zoom,
    }) as Map;
  });

  const LineLayerForms = map.current
    ? lines_layers.map((layer_meta) => (
        <MapboxLinesLayerForm
          this_cell_id={lines_cell_id}
          layer_meta={layer_meta}
          dispatch={linesLayerDispatch}
          map={map.current!}
        />
      ))
    : "";

  const DiffLayerForms = map.current
    ? diff_layers.map((layer_meta) => (
        <MapboxDiffLayerForm
          this_cell_id={diffs_cell_id}
          layer_meta={layer_meta}
          dispatch={diffLayerDispatch}
          map={map.current!}
        />
      ))
    : "";

  const NetworkFlowLayerForms = map.current
    ? network_flow_layers.map((layer_meta) => (
        <MapboxNetworkFlowLayerForm
          this_cell_id={network_flow_cell_id}
          layer_meta={layer_meta}
          dispatch={networkFlowLayerDispatch}
          map={map.current!}
        />
      ))
    : "";

  // The links at the bottom of the map: https://docs.mapbox.com/help/getting-started/attribution/
  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Mapbox Cell
      </Typography>

      {LineLayerForms}
      {DiffLayerForms}
      {NetworkFlowLayerForms}

      <div style={{ padding: 10 }}>
        <span style={{ padding: 10 }}>
          <Button
            variant="contained"
            color="success"
            onClick={() =>
              linesLayerDispatch({
                type: LinesLayerCellActionType.ADD_LAYER,
                payload: uuid(),
              })
            }
          >
            Add Lines Layer
          </Button>
        </span>

        <span style={{ padding: 10 }}>
          <Button
            variant="contained"
            color="success"
            onClick={() =>
              diffLayerDispatch({
                type: DiffLayerCellActionType.ADD_LAYER,
                payload: uuid(),
              })
            }
          >
            Add Diff Layer
          </Button>
        </span>

        <span style={{ padding: 10 }}>
          <Button
            variant="contained"
            color="success"
            onClick={() =>
              networkFlowLayerDispatch({
                type: NetworkFlowLayerCellActionType.ADD_LAYER,
                payload: uuid(),
              })
            }
          >
            Add Network Flow Layer
          </Button>
        </span>
      </div>
      <div
        style={{ height: "750px" }}
        ref={mapContainer}
        className="map-container"
      />
    </div>
  );
}
