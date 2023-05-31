import { useContext, useReducer, useEffect } from "react";
import { produce, Draft } from "immer";
import _ from "lodash";

import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import AbstractMapCellState, {
  reducer as abstractMapCellReducer,
} from "../AbstractMapCellState";

import CellsContext from "../CellsContext";
import { CellAction, MapSource, CellType } from "../domain";

// FIXME: Get from API
const years = _.range(2017, 2023);

// NOTE: Could not get merging enums to work. Need to just copy them.
// https://stackoverflow.com/a/55827534
export enum CellActionType {
  SET_NAME = "SET_NAME",
  SET_DEPENDENCY = "SET_DEPENDENCY",
  SET_YEAR = "SET_YEAR",
}

export function reducer(cell: MapYearCellState, action: CellAction) {
  cell = abstractMapCellReducer(cell, action) as MapYearCellState;

  const { type, payload } = action;

  if (type === CellActionType.SET_YEAR) {
    return cell.setYear(payload);
  }

  return cell;
}

export class MapYearCellState extends AbstractMapCellState {
  public descriptor: {
    map: MapSource;
    year: number;
  };

  public is_stale: false;

  constructor() {
    super(CellType.MapYearCell);
    this.descriptor = { year: Math.max(...years), map: MapSource.NPMRDS };
    this.is_stale = false;
  }

  get is_ready() {
    return !!(this.descriptor.map && this.descriptor.year);
  }

  get dependencies() {
    return null;
  }

  setMapSource(map: MapSource) {
    return produce(this, (draft: Draft<this>) => {
      draft.descriptor.map = map;
    });
  }

  setYear(year: number) {
    return produce(this, (draft: Draft<this>) => {
      draft.descriptor.year = year;
    });
  }
}

function YearSelector({
  year,
  cell_name,
  dispatchChangeCellName,
  dispatchYearChange,
}: {
  year: number;
  cell_name: string;
  dispatchChangeCellName: (name: string) => void;
  dispatchYearChange: (year: number) => void;
}) {
  const menu_items = years.map((year) => (
    <MenuItem key={`map_year_${year}`} value={year}>
      {year}
    </MenuItem>
  ));

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
          <InputLabel id="demo-simple-select-label">Year</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="demo-simple-select"
            value={`${year}`}
            label="Year"
            onChange={(event: SelectChangeEvent) =>
              dispatchYearChange(+event.target.value)
            }
          >
            {menu_items}
          </Select>
        </FormControl>
      </div>
    </div>
  );
}

export default function MapYearCell() {
  const [state, dispatch] = useReducer(reducer, new MapYearCellState());

  const { updateCellState } = useContext(CellsContext);

  useEffect(() => {
    updateCellState(state);
  }, [state, updateCellState]);

  const cell_type = state.cell_type;
  const cell_name = state?.name;
  const year = state?.descriptor?.year;

  const dispatchChangeCellName = (name: string) =>
    dispatch({
      type: CellActionType.SET_NAME,
      payload: name,
    });

  const dispatchYearChange = (year: number) =>
    dispatch({
      type: CellActionType.SET_YEAR,
      payload: year,
    });

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        {cell_type}
      </Typography>
      <YearSelector
        year={year}
        cell_name={cell_name}
        dispatchYearChange={dispatchYearChange}
        dispatchChangeCellName={dispatchChangeCellName}
      />
    </div>
  );
}
