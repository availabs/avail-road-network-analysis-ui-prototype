import { useContext, useEffect, useReducer } from "react";

import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { produce, Draft } from "immer";

import CellsContext from "../CellsContext";
import AbstractMapCellState, {
  reducer as abstractMapCellReducer,
} from "../AbstractMapCellState";
import { CellID, CellType } from "../domain";

enum Direction {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}

type Discriptor = {
  direction: Direction | null;
  distance: number | null;
};

// NOTE: Could not get merging enums to work. Need to just copy them.
// https://stackoverflow.com/a/55827534
enum CellActionType {
  SET_NAME = "SET_NAME",
  SET_DEPENDENCY = "SET_DEPENDENCY",
  SET_DIRECTION = "SET_DIRECTION",
  SET_DISTANCE = "SET_DISTANCE",
}

type CellAction = {
  type: CellActionType;
  payload: any;
};

export function reducer(cell: MapTraverseCellState, action: CellAction) {
  cell = abstractMapCellReducer(cell, action) as MapTraverseCellState;

  const { type, payload } = action;

  if (type === CellActionType.SET_NAME) {
    return cell.setName(payload);
  }

  if (type === CellActionType.SET_DEPENDENCY) {
    return cell.setDependencies(payload);
  }

  if (type === CellActionType.SET_DIRECTION) {
    return cell.setDirection(payload);
  }

  if (type === CellActionType.SET_DISTANCE) {
    return cell.setDistance(payload);
  }

  return cell;
}

class MapTraverseCellState extends AbstractMapCellState {
  readonly descriptor: Discriptor;
  readonly dependencies: CellID[] | null;

  constructor() {
    super(CellType.MapTraverseCell);
    this.descriptor = {
      direction: null,
      distance: null,
    };

    this.dependencies = null;
  }

  get is_ready() {
    return !!(this.descriptor.direction && this.descriptor.distance !== null);
  }

  setDependencies(cell_id: [CellID]): this {
    return super.setDependencies(cell_id);
  }

  setDirection(direction: Direction) {
    return produce(this, (draft: Draft<this>) => {
      draft.descriptor.direction = direction;
    });
  }

  setDistance(distance: number) {
    return produce(this, (draft: Draft<this>) => {
      draft.descriptor.distance = distance;
    });
  }
}

function CellForm({
  this_cell_id,
  cell_name,
  direction,
  dispatchChangeCellName,
  dispatchDependencyChange,
  dispatchDirectionChange,
  dispatchDistanceChange,
}: {
  this_cell_id: CellID;
  cell_name: string;
  direction: Direction | null;
  dispatchChangeCellName: (name: string) => void;
  dispatchDependencyChange: (cell_id: CellID) => void;
  dispatchDirectionChange: (direction: Direction) => void;
  dispatchDistanceChange: (distance: number) => void;
}) {
  const { cells } = useContext(CellsContext);

  const this_cell = cells[this_cell_id];

  if (!this_cell) {
    return null;
  }

  console.log({ this_cell_id, cells });

  const candidates = Object.values(cells).filter((cell_state) => {
    const is_map_cell = cell_state instanceof AbstractMapCellState;
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
          <FormHelperText>The map to traverse.</FormHelperText>
        </FormControl>
        <div>
          <FormControl sx={{ m: 1, minWidth: 300 }}>
            <InputLabel id="demo-simple-select-label">Direction</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="tmc-prop-name-select"
              value={`${direction || ""}`}
              label="Traverse Direction"
              onChange={(event: SelectChangeEvent) => {
                dispatchDirectionChange(event.target.value as Direction);
              }}
            >
              <MenuItem value={Direction.INBOUND}>Inbound</MenuItem>
              <MenuItem value={Direction.OUTBOUND}>Outbound</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ m: 1, minWidth: 300 }}>
            <TextField
              required
              id="outlined-required"
              label="Distance (mi)"
              onChange={({ target: { value } }) => {
                dispatchDistanceChange(+value);
              }}
            />
            <FormHelperText>The distance in miles to traverse.</FormHelperText>
          </FormControl>
        </div>
      </div>
    </div>
  );
}

export default function MapTraverseCell() {
  const [state, dispatch] = useReducer(reducer, new MapTraverseCellState());

  const { updateCellState } = useContext(CellsContext);

  useEffect(() => {
    updateCellState(state);
  }, [state, updateCellState]);

  const {
    cell_id,
    cell_type,
    name: cell_name,
    descriptor: { direction },
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

  const dispatchDirectionChange = (direction: Direction) =>
    dispatch({
      type: CellActionType.SET_DIRECTION,
      payload: direction,
    });

  const dispatchDistanceChange = (distance: number) =>
    dispatch({
      type: CellActionType.SET_DISTANCE,
      payload: distance,
    });

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        {cell_type}
      </Typography>
      <CellForm
        this_cell_id={cell_id}
        cell_name={cell_name}
        direction={direction}
        dispatchChangeCellName={dispatchChangeCellName}
        dispatchDependencyChange={dispatchDependencyChange}
        dispatchDirectionChange={dispatchDirectionChange}
        dispatchDistanceChange={dispatchDistanceChange}
      />
    </div>
  );
}
