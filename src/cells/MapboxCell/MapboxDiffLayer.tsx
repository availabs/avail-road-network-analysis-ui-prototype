import { useContext, useEffect, useRef, useState } from "react";

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
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

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

type Tmc = string;

enum TmcType {
  "P1.11" = "cross-roads",
  "P1.3" = "motorway junction",
  "P4.0" = "link road point",
  "P3.14" = "border/frontier",
  "P1.1" = "motorway intersection",
  "P3.2" = "bridge",
  "P1.13" = "intermediate node",
  "P1.8" = "roundabout",
  "P3.16" = "toll plaza",
  "P3.3" = "service area",
  "P3.1" = "tunnel",
  "P3.37" = "place name",
  "P3.18" = "harbour",
  "P3.4" = "rest area",
  "P1.7" = "underpass",
  "P1.6" = "flyover",
  "P3.17" = "ferry terminal",
  "P3.27" = "airport",
  "P1.10" = "traffic lights",
}

type CrossingEdge = {
  tmc: string;
  bearing: number;
  roadname: string;
  direction: string;
  roadnumber: string;
};

type TraversedCrossingMeta = {
  tmcs: Tmc[];
  node_id: number;
  firstnames: string[];
  linear_ids: number[];
  pt_geom_idx: 1;
  inbound_edges: CrossingEdge[];
  outbound_edges: CrossingEdge[];
  dist_along_path_meters: number;
};

type NodeIncidentTmcMeta = {
  tmc: string;
  direction: string;
  linear_id: number;
};

type TmcNetworkDescription = {
  tmc: Tmc;
  firstname: string | null;
  is_nhs: boolean | null;
  roadname: string | null;
  roadnumber: string | null;
  miles: number;
  state: string;
  end_longitude: number;
  county: string;
  direction: string;
  start_longitude: number;
  type: string;
  road_order: number;
  func_class: number;
  zip: string;
  start_latitude: number;
  linear_id: number;
  end_latitude: number;
  start_node_id: number;
  start_node_idx: number;
  end_node_id: number;
  end_node_idx: number;
  length_meters: number;
  traversed_crossings_meta: TraversedCrossingMeta[];
  start_node_inbound_tmcs: NodeIncidentTmcMeta[];
  end_node_outbound_tmcs: NodeIncidentTmcMeta[];
};

type TmcCrossYearSimilarity = {
  tmc: Tmc;
  length_meters_a: number;
  length_meters_b: number;
  straight_line_dist_meters_a: number;
  straight_line_dist_meters_b: number;
  bearing_degrees_a: number;
  bearing_degrees_b: number;
  sinuosity_a: number;
  sinuosity_b: number;
  start_pt_diff_meters: number;
  end_pt_diff_meters: number;
  hausdorff_distance_meters: number;
  frechet_distance_meters: number;
};

type TmcCrossYearReference = {
  tmc: "120+25380";
  linear_id_a: "12003689";
  direction_a: "WESTBOUND";
  start_node_id_a: 15569;
  start_node_pt_geom_idx_a: 1;
  start_node_idx_along_path_a: 40;
  start_dist_along_path_meters_a: 746.75039997;
  end_node_id_a: 15402;
  end_node_idx_a: 4;
  end_node_idx_along_path_a: 43;
  end_dist_along_path_meters_a: 877.47180477;
  reference_node_id_a: 15112;
  reference_node_idx_along_path_a: 59;
  reference_node_dist_along_path_a: 2342.04438466;
  reference_node_is_on_tmc_a: false;
  tmc_start_dist_from_reference_node_a: -1595.29398469;
  tmc_end_dist_from_reference_node_a: -1464.57257989;
  linear_id_b: "12003689";
  direction_b: "NORTHBOUND";
  start_node_id_b: 15939;
  start_node_pt_geom_idx_b: 1;
  start_node_idx_along_path_b: 19;
  start_dist_along_path_meters_b: 396.80655288;
  end_node_id_b: 15533;
  end_node_idx_b: 10;
  end_node_idx_along_path_b: 28;
  end_dist_along_path_meters_b: 792.29258621;
  reference_node_id_b: 15533;
  reference_node_idx_along_path_b: 28;
  reference_node_dist_along_path_b: 792.29258621;
  reference_node_is_on_tmc_b: true;
  tmc_start_dist_from_reference_node_b: -395.48603333;
  tmc_end_dist_from_reference_node_b: 0;
  node_id_a: 15112;
  node_id_b: 15533;
  label: [[12003510, 12003689], [12003510, 12003689]];
  label_fields: ["linear_id"];
  conformal_level: "3.002";
  match_class: null;
  start_node_reference_rank_a: "7";
  end_node_reference_rank_a: "7";
  start_node_reference_rank_b: "3";
  end_node_reference_rank_b: "1";
};

type TmcCrossYearDescription = {
  tmc_net_description_a: TmcNetworkDescription;
  tmc_net_description_b: TmcNetworkDescription;
  tmc_cross_year_similarity: TmcCrossYearSimilarity;
  tmc_cross_year_reference: TmcCrossYearReference;
};

function TmcDescription({
  year_a,
  year_b,
  tmc_description,
}: {
  year_a: number;
  year_b: number;
  tmc_description: TmcCrossYearDescription | null;
}) {
  if (!tmc_description) {
    return <div />;
  }

  const {
    tmc_net_description_a,
    tmc_net_description_b,
    tmc_cross_year_similarity,
    tmc_cross_year_reference,
  } = tmc_description;

  const min_year = Math.min(year_a, year_b);
  const max_year = Math.max(year_a, year_b);

  return (
    <Card sx={{ minWidth: 275, marginTop: 3 }}>
      <CardContent>
        <Typography variant="h4" gutterBottom>
          TMC Cross-Year Description
        </Typography>
        <Typography variant="h6" gutterBottom>
          TMC: {tmc_net_description_a.tmc}
        </Typography>

        <TableContainer component={Paper}>
          <Table sx={{ maxWidth: 800 }} aria-label="simple table">
            <TableHead>
              <TableRow style={{ backgroundColor: "black" }}>
                <TableCell style={{ color: "white" }}>Property</TableCell>
                <TableCell style={{ color: "white" }} align="right">
                  {min_year}
                </TableCell>
                <TableCell style={{ color: "white" }} align="right">
                  {max_year}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  County
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_a.county}
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_b.county}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  ZIP Code
                </TableCell>
                <TableCell align="right">{tmc_net_description_a.zip}</TableCell>
                <TableCell align="right">{tmc_net_description_b.zip}</TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  Road Number
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_a.roadnumber}
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_b.roadnumber}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  Road Name
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_a.roadname}
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_b.roadname}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  Direction
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_a.direction}
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_b.direction}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  Functional Class
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_a.func_class}
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_b.func_class}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  TMC Linear (Road Corridor ID)
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_a.linear_id}
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_b.linear_id}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  TMC Type
                </TableCell>
                <TableCell align="right">
                  {
                    // @ts-ignore
                    TmcType[tmc_net_description_a.type]
                  }
                </TableCell>
                <TableCell align="right">
                  {
                    // @ts-ignore
                    TmcType[tmc_net_description_b.type]
                  }
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <TableContainer component={Paper}>
          <Table sx={{ maxWidth: 800 }} aria-label="simple table">
            <TableHead>
              <TableRow style={{ backgroundColor: "black" }}>
                <TableCell style={{ color: "white" }}>Property</TableCell>
                <TableCell style={{ color: "white" }} align="right">
                  {min_year}
                </TableCell>
                <TableCell style={{ color: "white" }} align="right">
                  {max_year}
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  Length (miles)
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_a.miles}
                </TableCell>
                <TableCell align="right">
                  {tmc_net_description_b.miles}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  Length (meters)
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.length_meters_a}
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.length_meters_b}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  Straight Line Distance (meters)
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.straight_line_dist_meters_a}
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.straight_line_dist_meters_b}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <a
                    href="https://en.wikipedia.org/wiki/Sinuosity"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Sinuosity
                  </a>{" "}
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.sinuosity_a}
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.sinuosity_b}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <a
                    href="https://postgis.net/docs/ST_Azimuth.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Bearing
                  </a>{" "}
                  (degrees)
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.bearing_degrees_a}
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.bearing_degrees_b}
                </TableCell>
              </TableRow>

              {
                // "tmc": "120+12007",
                // "length_meters_a": 546.072543381295,
                // "length_meters_b": 704.079262866645,
                // "straight_line_dist_meters_a": 402.189901727006,
                // "straight_line_dist_meters_b": 476.526919306459,
                // "bearing_degrees_a": 279.947897489255,
                // "bearing_degrees_b": 280.446670708849,
                // "sinuosity_a": 1.35774802160983,
                // "sinuosity_b": 1.47752253721861,
                // "start_pt_diff_meters": 75.268041201556,
                // "end_pt_diff_meters": 5.68220403127535,
                // "hausdorff_distance_meters": 75.268041201556,
                // "frechet_distance_meters": 71.9705167567399
              }
            </TableBody>
          </Table>
        </TableContainer>

        <TableContainer component={Paper}>
          <Table sx={{ maxWidth: 800 }} aria-label="simple table">
            <TableHead>
              <TableRow style={{ backgroundColor: "black" }}>
                <TableCell style={{ color: "white" }}>Property</TableCell>
                <TableCell style={{ color: "white" }} align="right">
                  Value
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  Distance Between Start Points (meters)
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.start_pt_diff_meters}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  Distance Between End Points (meters)
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.end_pt_diff_meters}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <a
                    href="https://en.wikipedia.org/wiki/Hausdorff_distance"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Hausdorff Distance
                  </a>{" "}
                  (meters)
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.hausdorff_distance_meters}
                </TableCell>
              </TableRow>

              <TableRow
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <a
                    href="https://en.wikipedia.org/wiki/Hausdorff_distance"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Fréchet Distance
                  </a>{" "}
                  (meters)
                </TableCell>
                <TableCell align="right">
                  {tmc_cross_year_similarity.frechet_distance_meters}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
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

  // const now = new Date();
  // console.log(now);

  const names = getSourceAndLayerNames(layer_id);

  const [clicked_tmc, setClickedTmc] = useState(hovered_tmc);
  const handleClickContainer = useRef(setClickedTmc.bind(null, hovered_tmc));
  const [tmc_description, setTmcDescription] =
    useState<TmcCrossYearDescription | null>(null);

  const { cells } = useContext(CellsContext);

  const this_cell = cells[this_cell_id];

  console.log("==> clicked_tmc:", clicked_tmc);

  const [year_a, year_b] = [layer_dependency_id_a, layer_dependency_id_b].map(
    (layer_dependency_id) => {
      if (layer_dependency_id === null) {
        return null;
      }

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

      return year;
    }
  );

  useEffect(() => {
    if (!map) {
      return;
    }

    try {
      map.off("click", handleClickContainer.current);
    } catch (err) {}

    console.log("==> Set clicked_tmc to:", hovered_tmc || null);

    handleClickContainer.current = setClickedTmc.bind(
      null,
      hovered_tmc || null
    );

    map.on("click", handleClickContainer.current);
  }, [map, hovered_tmc]);

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

  useEffect(() => {
    (async () => {
      if (clicked_tmc === null) {
        setTmcDescription(null);
        return;
      }

      if (year_a === null || year_b === null) {
        return;
      }

      const [
        tmc_net_description_a,
        tmc_net_description_b,
        tmc_cross_year_similarity,
        tmc_cross_year_reference,
      ] = await Promise.all([
        (async () => {
          const url = new URL(
            `${API_URL}/data-types/npmrds/network-analysis/getTmcNetworkDescription`
          );

          url.searchParams.append("tmc", clicked_tmc);
          url.searchParams.append("year", year_a);

          const res = await fetch(url);

          return res.json();
        })(),

        (async () => {
          const url = new URL(
            `${API_URL}/data-types/npmrds/network-analysis/getTmcNetworkDescription`
          );

          url.searchParams.append("tmc", clicked_tmc);
          url.searchParams.append("year", year_b);

          const res = await fetch(url);

          return res.json();
        })(),

        (async () => {
          const url = new URL(
            `${API_URL}/data-types/npmrds/network-analysis/getTmcCrossYearSimilarity`
          );

          url.searchParams.append("tmc", clicked_tmc);
          url.searchParams.append("year", year_a);
          url.searchParams.append("year", year_b);

          const res = await fetch(url);

          return res.json();
        })(),

        (async () => {
          const url = new URL(
            `${API_URL}/data-types/npmrds/network-analysis/getTmcCrossYearReference`
          );

          url.searchParams.append("tmc", clicked_tmc);
          url.searchParams.append("year", year_a);
          url.searchParams.append("year", year_b);

          const res = await fetch(url);

          return res.json();
        })(),
      ]);

      const new_tmc_description = {
        tmc_net_description_a,
        tmc_net_description_b,
        tmc_cross_year_similarity,
        tmc_cross_year_reference,
      };

      console.log(new_tmc_description);

      setTmcDescription(new_tmc_description);
    })();
  }, [clicked_tmc, year_a, year_b]);

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
      // console.log(now);
      const tmc = (e && e.features && e.features?.[0]?.properties?.tmc) || null;

      // console.log("==> tmc", tmc);

      if (tmc !== hovered_tmc) {
        // console.log("Updating hovered TMC from", hovered_tmc, "to", tmc);
        setHoveredTmc(tmc);
      } else if (tmc === null && hovered_tmc !== null) {
        // console.log("Updating hovered TMC from", hovered_tmc, "to", tmc);
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

    // https://docs.mapbox.com/mapbox-gl-js/example/popup-on-click/
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
