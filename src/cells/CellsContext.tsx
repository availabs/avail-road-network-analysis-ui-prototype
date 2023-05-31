// https://dougschallmoser.medium.com/context-api-usereducer-in-react-2691c137f5f#

import { createContext, useReducer, ReactNode } from "react";

import { produce, immerable, Draft } from "immer";

import AbstractCellState from "./AbstractCellState";
import { CellID } from "./domain";

enum CellsContextActionType {
  UPDATE = "cells_context:UPDATE",
}

type CellsContextUpdateAction = {
  type: CellsContextActionType.UPDATE;
  payload: AbstractCellState;
};

type CellsContextAction = CellsContextUpdateAction;

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

export const initial_state = new CellsContextState();

export function reducer(state: CellsContextState, action: CellsContextAction) {
  const { type, payload } = action;

  if (type === CellsContextActionType.UPDATE) {
    return state.updateCellState(payload);
  }

  return state;
}

const CellsContext = createContext(initial_state);

export const CellsContextProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initial_state);

  function updateCellState(cell_state: AbstractCellState) {
    dispatch({
      type: CellsContextActionType.UPDATE,
      payload: cell_state,
    });
  }

  return (
    <CellsContext.Provider
      value={{
        cells: state.cells,
        // @ts-ignore
        updateCellState,
      }}
    >
      {children}
    </CellsContext.Provider>
  );
};

export default CellsContext;
