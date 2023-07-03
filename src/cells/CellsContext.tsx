import { createContext, useRef, useCallback, ReactNode } from "react";

import { produce, immerable, Draft } from "immer";
import { atom, useRecoilState } from "recoil";

import _ from "lodash";

import AbstractCellState from "./AbstractCellState";
import { CellID } from "./domain";

export type CellLookup = Record<CellID, AbstractCellState>;

// https://immerjs.github.io/immer/complex-objects/
class CellsContextState {
  [immerable] = true;

  constructor(public cells: Record<CellID, AbstractCellState> = {}) {}

  updateCellState(cell_state: AbstractCellState) {
    // console.log("==> updateCellState:", cell_state);
    return produce(this, (draft: Draft<this>) => {
      draft.cells[cell_state.cell_id] = cell_state;
    });
  }

  deleteCellState(cell_id: CellID) {
    return produce(this, (draft: Draft<this>) => {
      delete draft.cells[cell_id];
    });
  }
}

const cells_atom = atom<CellsContextState>({
  key: "cells_context_state",
  default: new CellsContextState(),
});

export function useCellsState() {
  const [cells_context_state, updateCellsContextState] =
    useRecoilState(cells_atom);

  const cells_ref = useRef(cells_context_state);

  // updateCellState should remain a constant because cells_ref and updateCells should be constant.
  const updateCellState = useCallback(
    (cell_state: AbstractCellState) => {
      cells_ref.current = cells_ref.current.updateCellState(cell_state);
      updateCellsContextState(cells_ref.current);
    },
    [cells_ref, updateCellsContextState]
  );

  return { cells: cells_context_state.cells, updateCellState };
}

export function useCellsSubsetState(
  cell_id: CellID /*, include_ancestors = false*/
) {
  const { cells } = useCellsState();

  const cell = cells[cell_id];
  const dependencies = cell.dependencies
    ?.map((dep_id) => cells[dep_id])
    .filter(Boolean) as AbstractCellState[];

  const state_ref = useRef({ cell, dependencies });

  if (
    cell !== state_ref.current.cell ||
    _.difference(dependencies, state_ref.current.dependencies).length > 0 ||
    _.difference(state_ref.current.dependencies, dependencies).length > 0
  ) {
    state_ref.current = { cell, dependencies };
  }

  return state_ref.current;
}

const CellsContext = createContext<{
  cells: CellsContextState["cells"];
  updateCellState: Function;
  // @ts-ignore
}>(null);

export const CellsContextProvider = ({ children }: { children: ReactNode }) => {
  const { cells, updateCellState } = useCellsState();

  return (
    <CellsContext.Provider
      value={{
        cells,
        // @ts-ignore
        updateCellState,
      }}
    >
      {children}
    </CellsContext.Provider>
  );
};

export default CellsContext;
