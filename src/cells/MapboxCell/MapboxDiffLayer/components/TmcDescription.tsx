import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

import { TmcCrossYearDescription, TmcType } from "../domain";

export default function TmcDescription({
  year_a,
  year_b,
  tmc_description,
}: {
  year_a: number | null;
  year_b: number | null;
  tmc_description: TmcCrossYearDescription | null;
}) {
  if (!(tmc_description && year_a && year_b)) {
    return <div />;
  }

  const {
    tmc_net_description_a,
    tmc_net_description_b,
    tmc_cross_year_similarity,
    // tmc_cross_year_reference,
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
