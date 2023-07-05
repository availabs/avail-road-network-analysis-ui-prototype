import { MapSource, CellType } from "../cells/domain";

export default function getBaseMapDescriptorForYear(
  year: number,
  pseudo_cell_id: number
) {
  return {
    cell_id: pseudo_cell_id,
    cell_type: CellType.MapYearCell,
    dependencies: null,
    descriptor: { year, map: MapSource.NPMRDS },
  };
}
