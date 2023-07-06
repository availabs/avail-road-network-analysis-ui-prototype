import {
  useContext,
  useRef,
  useState,
  useEffect,
  useReducer,
  Suspense,
  MouseEventHandler,
} from "react";

import { v4 as uuid } from "uuid";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";

import { Rnd } from "react-rnd";

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

//  We let the descentent components inject visualizations into the ancestor
//    so that their positioning is relative to the map.
//
//  TODO: Move appendVisualizationToMap from props to Context to avoid props drilling.
//
//        Typed Composition via Dependency Injection of:
//          * Contoller/Presentation Components
//          * Recoil's DataFlow DAGs' Dynamic Dependencies
//            * https://recoiljs.org/docs/api-reference/core/selector/#dynamic-dependencies
//          * Pipelines from OpenAPIs to UI component building workflows working off persistable blueprints.
//
// https://legacy.reactjs.org/docs/render-props.html
// https://www.patterns.dev/posts/render-props-pattern
function WrappedViz({
  title = "Handle",
  render,
  dock_index = 0,
}: {
  title: string;
  render: ({
    height,
    width,
  }: {
    height: number;
    width: number;
  }) => JSX.Element | null;
  dock_index: number;
}) {
  const default_width = 320;
  const docked_x = dock_index * (default_width + 10);
  const [visible, setVisible] = useState(false);
  const [rnd_size, setRndSize] = useState({
    width: default_width,
    height: 200,
  });

  // TODO: These should Dock using <Foo>{...children}</Foo> and styling.
  const [rnd_position, setRndPosition] = useState({ x: docked_x, y: 0 });

  const toggleVisabilty: MouseEventHandler<HTMLSpanElement> = (e) => {
    console.log("MouseEvent Detail:", e.detail);

    if (e.detail === 2) {
      setVisible(!visible);
    }
  };

  const position = visible ? rnd_position : { x: docked_x, y: 0 };

  const viz = render(rnd_size) || <div>No Data</div>;

  return (
    <Rnd
      style={{
        alignItems: "center",
        justifyContent: "center",
        border: "solid 1px #ddd",
        background: "#f0f0f0",
        minWidth: rnd_size.width,
        minHeight: rnd_size.height,
      }}
      dragHandleClassName="rnd-handle"
      size={visible ? { ...rnd_size } : { height: 40, width: 160 }}
      position={position}
      onDragStop={(e, d) => {
        // Double-click to toggle visibility. Preserve old rnd_position.
        if (e.detail === 2) {
          return;
        }

        const was_dragged =
          (rnd_position.x !== d.x || rnd_position.y !== d.y) &&
          d.x !== docked_x &&
          d.y !== 0;

        console.log(
          "==> was_dragged:",
          was_dragged,
          e.detail === 1 && !visible
        );

        //  If not visible, need to double-click docked component
        //    to make visible and move to last visible position.
        if (e.detail === 1 && !visible) {
          if (was_dragged) {
            console.log("setRndPosition");
            setVisible(true);
            setRndPosition({ x: d.x, y: d.y });
          }

          return;
        }

        // Dragged position
        if (was_dragged) {
          console.log("setRndPosition");
          setRndPosition({ x: d.x, y: d.y });
        }
      }}
      onResizeStop={(_e, _direction, _ref, delta, _position) => {
        const { width, height } = delta;

        setRndSize({
          width: rnd_size.width + width,
          height: rnd_size.height + height,
        });
      }}
    >
      <Box style={{ width: "100%", height: "100%" }}>
        <Card style={{ height: "100%" }}>
          <CardContent>
            <span className="rnd-handle" onClick={toggleVisabilty}>
              {title}
            </span>
          </CardContent>
          <CardContent>{viz}</CardContent>
        </Card>
      </Box>
    </Rnd>
  );
}

// https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/
export default function MapboxCell() {
  const mapContainer = useRef(null);
  const map: { current: Map | null } = useRef(null);

  const [visualization_children, setVisualizationChilden] = useState([
    <div></div>,
  ]);

  console.log("visualization_children.length:", visualization_children.length);

  type AppendProps = {
    title: string;
    render: ({
      height,
      width,
    }: {
      height: number;
      width: number;
    }) => JSX.Element | null;
  };

  function appendVisualizationToMap(props: AppendProps | AppendProps[]) {
    props = Array.isArray(props) ? props : [props];

    const vizs = props.map((p2, i) => {
      const dock_index = visualization_children.length + i;
      const p = { ...p2, dock_index };

      return <WrappedViz {...p} key={dock_index} />;
    });

    setVisualizationChilden([...visualization_children, ...vizs]);
  }

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
          key={`mapbox_lines_layer_form_${lines_cell_id}`}
          this_cell_id={lines_cell_id}
          layer_meta={layer_meta}
          dispatch={linesLayerDispatch}
          map={map.current!}
        />
      ))
    : "";

  const DiffLayerForms = map.current
    ? diff_layers.map((layer_meta) => (
        <Suspense>
          <MapboxDiffLayerForm
            key={`mapbox_diff_layer_form_${lines_cell_id}`}
            this_cell_id={diffs_cell_id}
            layer_meta={layer_meta}
            dispatch={diffLayerDispatch}
            map={map.current!}
            appendVisualizationToMap={appendVisualizationToMap}
          />
        </Suspense>
      ))
    : "";

  const NetworkFlowLayerForms = map.current
    ? network_flow_layers.map((layer_meta) => (
        <MapboxNetworkFlowLayerForm
          key={`mapbox_network_flow_layer_form_${lines_cell_id}`}
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
      <Suspense>
        <div style={{ position: "absolute" }}>{visualization_children}</div>
      </Suspense>
    </div>
  );
}
