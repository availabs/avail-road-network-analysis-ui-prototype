import AbstractCellState from "./AbstractCellState";

export { CellActionType, reducer } from "./AbstractCellState";
export type { CellAction } from "./domain";

export default abstract class AbstractMapCellState extends AbstractCellState {}
