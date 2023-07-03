import { useCallback, useContext, useEffect, useRef, useState } from "react";

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

import useTmcsState from "../../../state/tmcs_ui";

import AbstractMapCellState from "../../AbstractMapCellState";
import { MapYearCellState } from "../../MapYearCell";

import { CellID } from "../../domain";

import CellsContext from "../../CellsContext";

import {
  getSourceAndLayerNames,
  getPolygons,
  getYearsFromLayerDependencies,
} from "./utils";

import { CellAction, CellActionType } from "./state";

import TmcDescription from "./components/TmcDescription";

import { getTmcNetworkDescription, getTmcFeatureCollections } from "./api";

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
    layer_visible,
  } = layer_meta;

  // const now = new Date();
  // console.log(now);

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

  useEffect(() => {
    console.log({ hovered_tmcs, selected_tmcs });
  }, [hovered_tmcs, selected_tmcs]);

  const hovered_tmcs_ref = useRef(hovered_tmcs);
  hovered_tmcs_ref.current = hovered_tmcs;

  const handleHover = useCallback(
    (e: any) => {
      console.log(e);
      // console.log(now);
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

  const [year_a, year_b] = getYearsFromLayerDependencies(
    cells,
    layer_dependency_id_a,
    layer_dependency_id_b
  );

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
        map.setFilter(layer_id, filter);
      } catch (err) {}
    }
  }, [map, layer_names, hovered_tmcs, selected_tmcs]);

  useEffect(() => {
    (async () => {
      const new_tmc_description = await getTmcNetworkDescription(
        year_a,
        year_b,
        selected_tmcs?.[0] || null
      );

      setTmcDescription(new_tmc_description);
    })();
  }, [selected_tmcs, year_a, year_b]);

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

  async function render() {
    const feature_collections = await getTmcFeatureCollections(
      cells,
      layer_dependency_id_a,
      layer_dependency_id_b
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

    removeAllMapListeners();

    for (const layer_id of Object.values(layer_names)) {
      try {
        map.removeLayer(layer_id);
      } catch (err) {
        console.error(err);
      }
    }

    for (const source_id of Object.values(source_names)) {
      try {
        map.removeSource(source_id);
      } catch (err) {
        console.error(err);
      }
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
    // map.removeLayer(layer_names.inxtn_polygons_fill);
    // // map.removeLayer(layer_names.inxtn_polygons_outline);
    // map.removeSource(source_names.inxtn_polygons);
    // } catch (err) {}

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

    // map.addLayer({
    // id: layer_names.inxtn_polygons_outline,
    // type: "line",
    // source: source_names.inxtn_polygons,
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

    try {
      map.removeLayer(layer_names.b_intxn);
      map.removeSource(source_names.b_intxn);
    } catch (err) {}

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

    try {
      map.removeLayer(layer_names.a_only);
      map.removeSource(source_names.a_only);
    } catch (err) {}

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

    try {
      map.removeLayer(layer_names.b_only);
      map.removeSource(source_names.b_only);
    } catch (err) {}

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
        </CardContent>
      </Card>

      <TmcDescription
        year_a={year_a}
        year_b={year_b}
        tmc_description={tmc_description}
      />
    </Box>
  );
}
