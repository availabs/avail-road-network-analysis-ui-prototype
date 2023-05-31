import { useState } from "react";

import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

import { CellsContextProvider } from "./cells/CellsContext";

import ProtoCell from "./cells/ProtoCell";

let counter = 0;

function App() {
  const [cell_components, setCellComponents] = useState([
    <ProtoCell key={`cell_${counter++}`} />,
  ]);

  return (
    <div style={{ height: "100%", paddingBottom: 100 }} className="App">
      <Container maxWidth="xl">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            AVAIL Road Network Analysis (prototype)
          </Typography>
          <CellsContextProvider>{cell_components}</CellsContextProvider>
        </Box>
        <Button
          variant="contained"
          color="success"
          onClick={() =>
            setCellComponents([
              ...cell_components,
              <ProtoCell key={`cell_${counter++}`} />,
            ])
          }
        >
          Add Cell
        </Button>
      </Container>
    </div>
  );
}

export default App;
