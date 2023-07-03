import { useState, useContext, useEffect } from "react";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import { CellType } from "./domain";
import CellsContext from "./CellsContext";

// import MapYearCell from "./MapYearCell";
import MapFilterCell from "./MapFilterCell";
import MapboxCell from "./MapboxCell";
import MapTraverseCell from "./MapTraverseCell";

// https://stackoverflow.com/a/40896168
const CellLookup = {
  // [CellType.MapYearCell]: MapYearCell,
  [CellType.MapFilterCell]: MapFilterCell,
  [CellType.MapboxCell]: MapboxCell,
  [CellType.MapTraverseCell]: MapTraverseCell,
};

function CellTypeSelector({
  setCellType,
}: {
  setCellType: (cell_type: CellType) => void;
}) {
  const menu_items = Object.entries(CellType).map(([k, v]) => (
    <MenuItem key={`v_${k}`} value={v}>
      {v}
    </MenuItem>
  ));

  return (
    <FormControl fullWidth>
      <InputLabel id="demo-simple-select-label">Cell Type</InputLabel>
      <Select
        labelId="demo-simple-select-label"
        id="demo-simple-select"
        label="Dependency Map"
        value={""}
        onChange={(event: SelectChangeEvent) => {
          setCellType(event.target.value as CellType);
        }}
      >
        {menu_items}
      </Select>
    </FormControl>
  );
}

export default function ProtoCell() {
  const [cell_type, setCellType] = useState(null);

  const { cells } = useContext(CellsContext);

  let elem;

  useEffect(() => {
    if (Object.keys(cells).length === 0) {
      // @ts-ignore
      setCellType(CellType.MapFilterCell);
    }
  }, [cells, setCellType]);

  if (!cell_type) {
    // @ts-ignore
    elem = <CellTypeSelector setCellType={setCellType} />;
  }

  if (cell_type) {
    const Comp = CellLookup[cell_type];
    // @ts-ignore
    elem = <Comp />;
  }

  return (
    <div style={{ paddingTop: "30px", paddingBottom: "30px" }}>
      <Box>
        <Card sx={{ minWidth: 275 }}>
          <CardContent>{elem}</CardContent>
        </Card>
      </Box>
    </div>
  );
}
