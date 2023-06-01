import { useContext, useEffect, useReducer } from "react";

import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { produce, Draft } from "immer";
import _ from "lodash";

import CellsContext from "../CellsContext";
import AbstractMapCellState, {
  reducer as abstractMapCellReducer,
} from "../AbstractMapCellState";
import { CellID, NpmrdsTmcPropertySource, CellType } from "../domain";

type MapFilterCellDescriptor = {
  tmc_property_source: NpmrdsTmcPropertySource | null;
  property_name: string | null;
  property_value: string | number | null;
};

// NOTE: Could not get merging enums to work. Need to just copy them.
// https://stackoverflow.com/a/55827534
enum CellActionType {
  SET_NAME = "SET_NAME",
  SET_DEPENDENCY = "SET_DEPENDENCY",
  SET_TMC_PROPERTIES_SOURCE = "SET_TMC_PROPERTIES_SOURCE",
  SET_PROPERTY_NAME = "SET_PROPERTY_NAME",
  SET_PROPERTY_VALUE = "SET_PROPERTY_VALUE",
}

type CellAction = {
  type: CellActionType;
  payload: any;
};

enum TmcMetadataFilterProperties {
  tmc = "TMC",
  county = "County",
  roadname = "Road Name",
  roadnumber = "Road Number",
  linear_id = "Linear ID",
  direction = "Direction",
  func_class = "Functional Class",
  is_nhs = "Is NHS",
}
export function reducer(cell: MapFilterCellState, action: CellAction) {
  let new_cell = abstractMapCellReducer(cell, action) as MapFilterCellState;

  const { type, payload } = action;

  if (type === CellActionType.SET_TMC_PROPERTIES_SOURCE) {
    new_cell = cell.setTmcPropertySource(payload);
  }

  if (type === CellActionType.SET_PROPERTY_NAME) {
    new_cell = cell.setPropertyName(payload);
  }

  if (type === CellActionType.SET_PROPERTY_VALUE) {
    new_cell = cell.setPropertyValue(payload);
  }

  if (new_cell !== cell) {
    new_cell = new_cell.setModifiedTimestamp();
  }

  return new_cell;
}

class MapFilterCellState extends AbstractMapCellState {
  readonly descriptor: MapFilterCellDescriptor;
  readonly dependencies: CellID[] | null;

  readonly last_descriptor: MapFilterCellDescriptor;
  readonly last_tmcs: string[] | null;

  constructor() {
    super(CellType.MapFilterCell);
    this.descriptor = {
      tmc_property_source: NpmrdsTmcPropertySource.tmc_metadata,
      property_name: null,
      property_value: null,
    };

    this.last_descriptor = _.cloneDeep(this.descriptor);
    this.last_tmcs = null;
    this.dependencies = null;
  }

  get is_ready() {
    return !!(
      this.descriptor.tmc_property_source &&
      this.descriptor.property_name &&
      this.descriptor.property_value
    );
  }

  setDependencies(cell_id: [CellID]): this {
    return super.setDependencies(cell_id);
  }

  setTmcPropertySource(tmc_property_source: NpmrdsTmcPropertySource) {
    return produce(this, (draft: Draft<this>) => {
      draft.descriptor.tmc_property_source = tmc_property_source;
    });
  }

  setPropertyName(property_name: string) {
    return produce(this, (draft: Draft<this>) => {
      draft.descriptor.property_name = property_name;
    });
  }

  setPropertyValue(property_value: string | number | null) {
    return produce(this, (draft: Draft<this>) => {
      draft.descriptor.property_value = property_value;
    });
  }

  get dependency_cell_id() {
    return this.dependencies?.[0] || null;
  }

  get tmcs() {
    return this.is_stale ? null : this.last_tmcs;
  }

  setTmcs(tmcs: string[]): this {
    return produce(this, (draft: Draft<this>) => {
      draft.last_tmcs = tmcs;
      draft.last_descriptor = this.descriptor;
    });
  }

  get is_stale() {
    return !_.isEqual(this.descriptor, this.last_descriptor);
  }
}

function CellForm({
  this_cell_id,
  cell_name,
  property_name,
  dispatchChangeCellName,
  dispatchDependencyChange,
  dispatchPropertyNameChange,
  dispatchPropertyValueChange,
}: {
  this_cell_id: CellID;
  cell_name: string;
  property_name: string | null;
  dispatchChangeCellName: (name: string) => void;
  dispatchDependencyChange: (cell_id: CellID) => void;
  dispatchPropertyNameChange: (property_name: string) => void;
  dispatchPropertyValueChange: (property_value: string) => void;
}) {
  const { cells } = useContext(CellsContext);

  const this_cell = cells[this_cell_id];

  if (!this_cell) {
    return null;
  }

  const candidates = Object.values(cells).filter((cell_state) => {
    const is_map_cell = cell_state instanceof AbstractMapCellState;
    const is_not_self = cell_state.cell_id !== this_cell_id;
    const is_not_dependent = !cell_state.dependencies?.includes(this_cell_id);

    return is_map_cell && is_not_self && is_not_dependent;
  });

  const [current_dependency_id = null] = cells[this_cell_id].dependencies || [];

  const current_dependency_name =
    current_dependency_id && cells[current_dependency_id].name;

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

  const prop_name_menu_items = Object.entries(TmcMetadataFilterProperties).map(
    ([k, v]) => (
      <MenuItem key={`prop_name_${k}`} value={k}>
        {v}
      </MenuItem>
    )
  );

  return (
    <div>
      <div>
        <FormControl sx={{ m: 1, minWidth: 300 }}>
          <TextField
            required
            id="outlined-required"
            label="Cell Name"
            defaultValue={cell_name}
            onChange={({ target: { value } }) => {
              dispatchChangeCellName(value);
            }}
          />
        </FormControl>
      </div>
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
          <InputLabel id="demo-simple-select-label">TMC Property</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="tmc-prop-name-select"
            value={`${property_name || ""}`}
            label="Dependency Map"
            onChange={(event: SelectChangeEvent) => {
              dispatchPropertyNameChange(event.target.value);
            }}
          >
            {prop_name_menu_items}
          </Select>
          <FormHelperText>
            The TMC property to use filtering {current_dependency_name}
          </FormHelperText>
        </FormControl>
        <FormControl sx={{ m: 1, minWidth: 300 }}>
          <TextField
            required
            id="outlined-required"
            label="TMC Property Value"
            onChange={({ target: { value } }) => {
              dispatchPropertyValueChange(value);
            }}
          />
          <FormHelperText>The TMC property value to match.</FormHelperText>
        </FormControl>
      </div>
    </div>
  );
}

export default function MapFilterCell() {
  const [state, dispatch] = useReducer(reducer, new MapFilterCellState());

  const { updateCellState } = useContext(CellsContext);

  useEffect(() => {
    updateCellState(state);
  }, [state, updateCellState]);

  const {
    cell_id,
    cell_type,
    name: cell_name,
    descriptor: { property_name },
  } = state;

  const dispatchChangeCellName = (name: string) =>
    dispatch({
      type: CellActionType.SET_NAME,
      payload: name,
    });

  const dispatchDependencyChange = (cell_id: number) =>
    dispatch({
      type: CellActionType.SET_DEPENDENCY,
      payload: cell_id,
    });

  const dispatchPropertyNameChange = (property_name: string) =>
    dispatch({
      type: CellActionType.SET_PROPERTY_NAME,
      payload: property_name,
    });

  const dispatchPropertyValueChange = (property_value: string) =>
    dispatch({
      type: CellActionType.SET_PROPERTY_VALUE,
      payload: property_value,
    });

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        {cell_type}
      </Typography>
      <CellForm
        this_cell_id={cell_id}
        cell_name={cell_name}
        property_name={property_name}
        dispatchChangeCellName={dispatchChangeCellName}
        dispatchDependencyChange={dispatchDependencyChange}
        dispatchPropertyNameChange={dispatchPropertyNameChange}
        dispatchPropertyValueChange={dispatchPropertyValueChange}
      />
    </div>
  );
}
