import { produce, Draft } from "immer";
import _ from "lodash";

import AbstractCellState, {
  reducer as abstractMapCellReducer,
} from "../../AbstractMapCellState";

import { CellID, CellType } from "../../domain";
import { LayerID, LayerMeta } from "./domain";

export enum CellActionType {
  ADD_LAYER = "ADD_LAYER",

  SET_LAYER_DEPENDENCY_A = "SET_LAYER_DEPENDENCY_A",
  SET_LAYER_DEPENDENCY_B = "SET_LAYER_DEPENDENCY_B",

  SET_LAYER_OFFSET = "SET_LAYER_OFFSET",

  TOGGLE_LAYER_VISIBILITY = "TOGGLE_LAYER_VISIBILITY",
}

export type CellAction = {
  type: CellActionType;
  payload: any;
};

export function mapboxDiffLayersReducer(
  cell: MapboxDiffLayerState,
  action: CellAction
) {
  cell = abstractMapCellReducer(cell, action) as MapboxDiffLayerState;

  const { type, payload } = action;

  if (type === CellActionType.ADD_LAYER) {
    console.log("\n\n", "==> mapboxDiffLayersReducer", type, "\n\n");
    return cell.addLayer(payload);
  }

  if (type === CellActionType.SET_LAYER_DEPENDENCY_A) {
    const { layer_id, cell_id } = payload;
    return cell.setLayerDependencyA(layer_id, cell_id);
  }

  if (type === CellActionType.SET_LAYER_DEPENDENCY_B) {
    const { layer_id, cell_id } = payload;
    return cell.setLayerDependencyB(layer_id, cell_id);
  }

  if (type === CellActionType.SET_LAYER_OFFSET) {
    const { layer_id, layer_offset } = payload;
    return cell.setLayerOffset(layer_id, layer_offset);
  }

  if (type === CellActionType.TOGGLE_LAYER_VISIBILITY) {
    const { layer_id } = payload;
    return cell.toggleLayerVisibility(layer_id);
  }

  return cell;
}

export class MapboxDiffLayerState extends AbstractCellState {
  readonly _descriptor: {
    layers: LayerMeta[];
  };

  constructor() {
    super(CellType.MapboxCell);

    this._descriptor = { layers: [] }; // put the layers and their styling here
  }

  get descriptor() {
    return this._descriptor;
  }

  get is_ready() {
    return !!this.dependencies?.length;
  }

  get dependencies() {
    return _.uniq(
      _.flatten(
        this.descriptor.layers
          .map(({ layer_dependency_id_a, layer_dependency_id_b }) => [
            layer_dependency_id_a,
            layer_dependency_id_b,
          ])
          .filter(Boolean)
      )
    ) as CellID[];
  }

  addLayer(layer_id: LayerID) {
    return produce(this, (draft: Draft<this>) => {
      const has_layer = draft._descriptor.layers.some(
        ({ layer_id: id }) => id === layer_id
      );

      if (has_layer) {
        return;
      }

      draft._descriptor.layers.push({
        layer_id,
        layer_dependency_id_a: null,
        layer_dependency_id_b: null,
        layer_offset: 1,
        layer_visible: true,
      });
    });
  }

  setLayerDependencyA(layer_id: LayerID, cell_id: CellID) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_dependency_id_a = cell_id;
    });
  }

  setLayerDependencyB(layer_id: LayerID, cell_id: CellID) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_dependency_id_b = cell_id;
    });
  }

  setLayerOffset(layer_id: LayerID, layer_offset: number) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_offset = layer_offset;
    });
  }

  toggleLayerVisibility(layer_id: LayerID) {
    return produce(this, (draft: Draft<this>) => {
      const layer_meta = draft._descriptor.layers.find(
        ({ layer_id: id }) => id === layer_id
      );

      layer_meta!.layer_visible = !layer_meta!.layer_visible;
    });
  }
}
