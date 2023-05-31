import { produce, immerable, Draft } from "immer";
import _ from "lodash";

import { CellID, CellType, CellAction } from "./domain";

let cell_id_seq = 0;

export enum CellActionType {
  SET_NAME = "SET_NAME",
  SET_DEPENDENCY = "SET_DEPENDENCY",
}

export function reducer(cell: AbstractCellState, action: CellAction) {
  const { type, payload } = action;

  if (type === CellActionType.SET_NAME) {
    // We don't want to update the modified_timestamp for name changes.
    cell = cell.setName(payload);
  }

  let new_cell = cell;

  if (type === CellActionType.SET_DEPENDENCY) {
    new_cell = cell.setDependencies(payload);
  }

  if (new_cell !== cell) {
    new_cell = new_cell.setModifiedTimestamp();
  }

  return new_cell;
}

// https://immerjs.github.io/immer/complex-objects/
export default abstract class AbstractCellState {
  [immerable] = true;

  constructor(
    public cell_type: CellType,
    public readonly cell_id: number = ++cell_id_seq,
    public name: string = "",
    public modified_timestamp: number = Date.now()
  ) {
    // default cell name
    this.name = this.name || `Cell ${this.cell_id}`;
  }

  abstract get is_ready(): boolean;
  abstract get dependencies(): CellID[] | null;
  abstract get descriptor(): object;

  setName(name: string) {
    return produce(this, (draft: Draft<this>) => {
      draft.name = name;
    });
  }

  setDependencies(dependencies: CellID | CellID[]): this {
    return produce(this, (draft: Draft<this>) => {
      dependencies = Array.isArray(dependencies)
        ? dependencies
        : [dependencies];

      draft.dependencies = _.isEqual(dependencies, this.dependencies)
        ? this.dependencies
        : dependencies;
    });
  }

  setModifiedTimestamp(): this {
    return produce(this, (draft: Draft<this>) => {
      draft.modified_timestamp = Date.now();
    });
  }

  // MUST be able to reconstruct ALL cells from localStorage using their meta.
  get meta() {
    if (!this.is_ready) {
      throw new Error("Cell is not ready.");
    }

    return {
      cell_id: this.cell_id,
      cell_type: this.cell_type,
      dependencies: this.dependencies,
      descriptor: this.descriptor,
    };
  }
}
