import {
  FunctionComponent,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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
import TextField from "@mui/material/TextField";

import years from "../../../constants/years";

import AbstractMapCellState from "../../AbstractMapCellState";
import { MapYearCellState } from "../../MapYearCell";

import { CellID } from "../../domain";

import CellsContext from "../../CellsContext";

import { getSourceAndLayerNames, getPolygons } from "./utils";

import { CellAction, CellActionType } from "./state";

import { useMapsMeta, useTmcFeatureCollections } from "./cached_data_state";
import useTmcsState from "./ui_state";
import { useProjectedTmcMeta } from "./derived_data_state";

import TmcDescription from "./components/TmcDescription";

import { getTmcNetworkDescription, getNodesForTmcs } from "./api";

import {
  // Tmc,
  LayerMeta,
  TmcFeature,
  TmcCrossYearDescription,
} from "./domain";

export {
  mapboxDiffLayersReducer,
  MapboxDiffLayerState,
  CellActionType,
} from "./state";

/*
function Foo() {
  const { tmc_meta_a, tmc_meta_b } = useProjectedTmcMeta();

  const [visible, setVisible] = useState(true);
  const [rnd_size, setRndSize] = useState({ width: 320, height: 200 });

  // useEffect(() => {
  // setTimeout(() => setVisible(!visible), 5000);
  // }, [visible, setVisible]);

  console.log(rnd_size);

  const pre = (
    <pre
      style={{
        width: visible ? rnd_size.width - 20 : 0,
        height: visible ? rnd_size.height - 80 : 0,
        overflowY: "auto",
        visibility: visible ? "visible" : "hidden",
      }}
    >
      {JSON.stringify({ tmc_meta_a, tmc_meta_b }, null, 4)}
    </pre>
  );

  return (
    <Rnd
      style={{
        alignItems: "center",
        justifyContent: "center",
        border: "solid 1px #ddd",
        background: "#f0f0f0",
      }}
      dragHandleClassName="rnd-handle"
      size={visible ? { ...rnd_size } : { height: 50, width: 100 }}
      onResizeStop={(e, direction, ref, delta, position) => {
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
            <span className="rnd-handle">Handle</span>
          </CardContent>
          <CardContent>{pre}</CardContent>
        </Card>
      </Box>
    </Rnd>
  );
}
*/

const Foo: ({
  height,
  width,
}: {
  height: number;
  width: number;
}) => JSX.Element = (props: { height: number; width: number }) => {
  const { height, width } = props;
  const { tmc_meta_a, tmc_meta_b } = useProjectedTmcMeta();

  return (
    <pre
      style={{
        width: width - 20,
        height: height - 80,
        overflowY: "auto",
      }}
    >
      {JSON.stringify({ tmc_meta_a, tmc_meta_b }, null, 4)}
    </pre>
  );
};

export function MapboxDiffLayerForm({
  this_cell_id,
  layer_meta,
  dispatch,
  map,
  appendVisualization,
}: {
  this_cell_id: CellID;
  layer_meta: LayerMeta;
  dispatch: (action: CellAction) => void;
  map: Map;
  appendVisualization: any;
}) {
  const {
    layer_id,
    layer_dependency_id_a,
    layer_dependency_id_b,
    layer_offset,
    layer_visible,
  } = layer_meta;

  const [map_year_a, setMapYearA] = useState(_.first(years));
  const [map_year_b, setMapYearB] = useState(_.last(years));

  const updateMapsMeta = useMapsMeta();
  const { features_a, features_b } = useTmcFeatureCollections();

  const [appended_rnd, setAppendedRnd] = useState(false);

  const [
    { sources: source_names, layers: layer_names },
    setSourceAndLayerNames,
  ] = useState(getSourceAndLayerNames(layer_id));

  useEffect(() => {
    setSourceAndLayerNames(getSourceAndLayerNames(layer_id));

    return;
  }, [layer_id]);

  const { hovered_tmcs, selected_tmcs, setHoveredTmcs, setSelectedTmcs } =
    useTmcsState();

  const hovered_tmcs_ref = useRef(hovered_tmcs);
  hovered_tmcs_ref.current = hovered_tmcs;

  const handleHover = useCallback(
    (e: any) => {
      const tmcs =
        e?.features
          ?.map((feature: any) => feature?.properties?.tmc)
          .filter(Boolean) || [];

      setHoveredTmcs(tmcs);
    },
    [setHoveredTmcs]
  );

  const handleClick = useCallback(() => {
    console.log("CLICK");
    setSelectedTmcs(hovered_tmcs_ref.current);
  }, [hovered_tmcs_ref, setSelectedTmcs]);

  const addMapListeners = useCallback(() => {
    map.on("click", handleClick);

    for (const layer_id of Object.values(layer_names)) {
      try {
        map.on("mousemove", layer_id, handleHover);
        map.on("mouseleave", layer_id, handleHover);
      } catch (err) {}
    }

    return () => {
      map.off("click", handleClick);

      for (const layer_id of Object.values(layer_names)) {
        try {
          map.off("mousemove", layer_id, handleHover);
          map.off("mouseleave", layer_id, handleHover);
        } catch (err) {}
      }
    };
  }, [map, layer_names, handleHover, handleClick]);

  const removeAllMapListeners = useCallback(() => {
    if (!map) {
      return;
    }

    map.off("click", handleClick);

    for (const layer_id of Object.values(layer_names)) {
      try {
        map.off("mousemove", layer_id, handleHover);
        map.off("mouseleave", layer_id, handleHover);
      } catch (err) {}
    }
  }, [map, layer_names, handleHover, handleClick]);

  const [tmc_description, setTmcDescription] =
    useState<TmcCrossYearDescription | null>(null);

  const { cells } = useContext(CellsContext);

  const this_cell = cells[this_cell_id];

  // const [year_a, year_b] = getYearsFromLayerDependencies(
  // cells,
  // layer_dependency_id_a,
  // layer_dependency_id_b
  // );

  useEffect(() => {
    if (!map) {
      return;
    }

    const { layers } = getSourceAndLayerNames(layer_id);

    for (const layer_id of Object.values(layers)) {
      try {
        if (map.getLayer(layer_id)) {
          map.setLayoutProperty(
            layer_id,
            "visibility",
            layer_visible ? "visible" : "none"
          );
        }
      } catch (err) {}
    }
  }, [map, layer_id, layer_visible]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const tmcs = selected_tmcs?.length ? selected_tmcs : hovered_tmcs;

    const filter = tmcs?.length
      ? ["match", ["get", "tmc"], tmcs, true, false]
      : null;

    for (const layer_id of Object.values(layer_names)) {
      try {
        if (map.getLayer(layer_id)) {
          map.setFilter(layer_id, filter);
        }
      } catch (err) {}
    }
  }, [map, layer_names, hovered_tmcs, selected_tmcs]);

  useEffect(() => {
    (async () => {
      const new_tmc_description = await getTmcNetworkDescription(
        // @ts-ignore
        map_year_a,
        // @ts-ignore
        map_year_b,
        selected_tmcs?.[0] || null
      );

      console.log(new_tmc_description);

      setTmcDescription(new_tmc_description);
    })();
  }, [selected_tmcs, map_year_a, map_year_b]);

  const dispatchLayerDependencyAChange = useCallback(
    (cell_id: CellID) =>
      dispatch({
        type: CellActionType.SET_LAYER_DEPENDENCY_A,
        payload: {
          layer_id,
          cell_id,
        },
      }),
    [layer_id, dispatch]
  );

  const dispatchLayerDependencyBChange = useCallback(
    (cell_id: CellID) =>
      dispatch({
        type: CellActionType.SET_LAYER_DEPENDENCY_B,
        payload: {
          layer_id,
          cell_id,
        },
      }),
    [layer_id, dispatch]
  );

  const dispatchLayerOffsetChange = useCallback(
    (layer_offset: number) =>
      dispatch({
        type: CellActionType.SET_LAYER_OFFSET,
        payload: {
          layer_id,
          layer_offset,
        },
      }),
    [layer_id, dispatch]
  );

  const dispatchToggleLayerVisibility = useCallback(
    () =>
      dispatch({
        type: CellActionType.TOGGLE_LAYER_VISIBILITY,
        payload: {
          layer_id,
        },
      }),
    [layer_id, dispatch]
  );

  const features_ref = useRef({ features_a, features_b });

  useEffect(() => {
    (async () => {
      if (features_a === null || features_b === null) {
        return;
      }

      if (
        features_ref.current.features_a === features_a &&
        features_ref.current.features_b
      ) {
        return;
      }

      console.log("=== RERENDER MAP ".repeat(3), "===");

      features_ref.current = {
        features_a,
        features_b,
      };

      const feature_collections = [features_a, features_b];

      type TmcFeaturesById = Record<string, TmcFeature>;
      const layer_a_features_by_tmc: TmcFeaturesById = {};

      for (const feature of feature_collections[0].features) {
        const {
          // @ts-ignore
          properties: { tmc },
        } = feature;

        // @ts-ignore
        const offset = turf.lineOffset(feature, +layer_offset / 3, {
          units: "yards",
        });

        // @ts-ignore
        layer_a_features_by_tmc[tmc] = offset;
      }

      const layer_b_features_by_tmc: TmcFeaturesById = {};

      for (const feature of feature_collections[1].features) {
        const {
          // @ts-ignore
          properties: { tmc },
        } = feature;

        // @ts-ignore
        const offset = turf.lineOffset(feature, (+layer_offset * 2) / 3, {
          units: "yards",
        });

        // @ts-ignore
        layer_b_features_by_tmc[tmc] = offset;
      }

      const layer_a_tmcs = Object.keys(layer_a_features_by_tmc);
      const layer_b_tmcs = Object.keys(layer_b_features_by_tmc);

      const [nodes_map_a, nodes_map_b] = await Promise.all([
        getNodesForTmcs(layer_a_tmcs, map_year_a as number),
        getNodesForTmcs(layer_b_tmcs, map_year_b as number),
      ]);

      console.log("=== nodes ".repeat(10));
      console.log({ nodes_map_a, nodes_map_b });
      console.log("=== nodes ".repeat(10));

      removeAllMapListeners();

      for (const layer_id of Object.values(layer_names)) {
        try {
          if (map.getLayer(layer_id)) {
            map.removeLayer(layer_id);
          }
        } catch (err) {
          console.error(err);
        }
      }

      for (const source_id of Object.values(source_names)) {
        try {
          if (map.getSource(source_id)) {
            map.removeSource(source_id);
          }
        } catch (err) {
          console.error(err);
        }
      }

      const a_tmcs = Object.keys(layer_a_features_by_tmc);
      const b_tmcs = Object.keys(layer_b_features_by_tmc);

      // A ∩ B
      const a_and_b_tmcs = _.intersection(a_tmcs, b_tmcs);

      const intxn_polygons = a_and_b_tmcs.map((tmc) =>
        getPolygons([
          layer_a_features_by_tmc[tmc],
          layer_b_features_by_tmc[tmc],
        ])
      );

      const intxn_polygons_feature_collection = turf.featureCollection(
        _.flatten(intxn_polygons)
      );

      map.addSource(source_names.inxtn_polygons, {
        type: "geojson",
        data: intxn_polygons_feature_collection,
      });

      map.addLayer({
        id: layer_names.inxtn_polygons_fill,
        type: "fill",
        source: source_names.inxtn_polygons,
        layout: {},
        paint: {
          "fill-color": "#f3f700",
          "fill-opacity": 0.5,
          // "line-offset": layer_offset * 2,
        },
      });

      const a_intxn_feature_collection = turf.featureCollection(
        a_and_b_tmcs.map((tmc) => layer_a_features_by_tmc[tmc])
      );

      map.addSource(source_names.a_intxn, {
        type: "geojson",
        data: a_intxn_feature_collection,
      });

      // https://stackoverflow.com/a/49924026
      map.addLayer({
        id: layer_names.a_intxn,
        type: "line",
        source: source_names.a_intxn,
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

      map.addSource(source_names.b_intxn, {
        type: "geojson",
        data: b_intxn_feature_collection,
      });

      map.addLayer({
        id: layer_names.b_intxn,
        type: "line",
        source: source_names.b_intxn,
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

      map.addSource(source_names.a_only, {
        type: "geojson",
        data: a_only_feature_collection,
      });

      map.addLayer({
        id: layer_names.a_only,
        type: "line",
        source: source_names.a_only,
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

      map.addSource(source_names.b_only, {
        type: "geojson",
        data: b_only_feature_collection,
      });

      map.addLayer({
        id: layer_names.b_only,
        type: "line",
        source: source_names.b_only,
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

      addMapListeners();
    })();
  }, [
    features_a,
    features_b,
    addMapListeners,
    dispatchToggleLayerVisibility,
    layer_names,
    layer_visible,
    map,
    map_year_a,
    map_year_b,
    layer_offset,
    removeAllMapListeners,
    source_names,
  ]);

  async function render() {
    updateMapsMeta(
      cells,
      layer_dependency_id_a as CellID,
      map_year_a as number,
      layer_dependency_id_b as CellID,
      map_year_b as number
    );
  }

  if (!this_cell) {
    console.log("===\n".repeat(3));
    console.log({ cells, this_cell_id, this_cell });
    console.log("===\n".repeat(3));
    return null;
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

  const years_menu_items_a = years.map((year) => (
    <MenuItem key={`map_year_${year}`} value={year}>
      {year}
    </MenuItem>
  ));

  const years_menu_items_b = years.map((year) => (
    <MenuItem key={`map_year_${year}`} value={year}>
      {year}
    </MenuItem>
  ));

  const dep_map_menu_items = candidate_id_name_pairs.map(
    ([cell_id, cell_name]) => (
      <MenuItem key={`cell_${cell_id}`} value={cell_id}>
        {cell_name}
      </MenuItem>
    )
  );

  if (!appended_rnd) {
    // @ts-ignore
    appendVisualization({ title: "TMC Metadata", render: Foo });
    setAppendedRnd(true);
  }

  // https://stackoverflow.com/a/32917613/3970755
  return (
    <Box key={layer_id} style={{ paddingBottom: 10 }}>
      <Card sx={{ minWidth: 275 }}>
        <div>
          <FormControl sx={{ m: 1, minWidth: 300 }}>
            <InputLabel id="demo-simple-select-label">
              Dependency Map A Descriptor
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
            <InputLabel id="demo-simple-select-label">Map A Year</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={`${map_year_a}`}
              label="Map A Year"
              onChange={(event: SelectChangeEvent) =>
                setMapYearA(+event.target.value)
              }
            >
              {years_menu_items_a}
            </Select>
          </FormControl>
        </div>

        <div>
          <FormControl sx={{ m: 1, minWidth: 300 }}>
            <InputLabel id="demo-simple-select-label">
              Dependency Map B Descriptor
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

          <FormControl sx={{ m: 1, minWidth: 300 }}>
            <InputLabel id="demo-simple-select-label">Map B Year</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={`${map_year_b}`}
              label="Map B Year"
              onChange={(event: SelectChangeEvent) =>
                setMapYearB(+event.target.value)
              }
            >
              {years_menu_items_b}
            </Select>
          </FormControl>
        </div>

        <div>
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
            <Button variant="contained" color="success" onClick={render}>
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
        </div>
      </Card>
      <TmcDescription
        year_a={map_year_a as number}
        year_b={map_year_b as number}
        tmc_description={tmc_description}
      />
    </Box>
  );
}
