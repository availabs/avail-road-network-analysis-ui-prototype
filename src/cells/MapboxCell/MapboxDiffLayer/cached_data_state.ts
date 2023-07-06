import { useRef, useCallback } from "react";
import { atom, selector, useSetRecoilState, useRecoilValue } from "recoil";

import * as turf from "@turf/turf";

import { CellID } from "../../domain";
import getTmcFeatures from "../../../api/getTmcFeatures";

import { CellLookup } from "../../CellsContext";

import { getTmcLinearPathsMeta, getTmcs, getTmcsMetadata } from "./api";

type TmcFeatures = turf.FeatureCollection<turf.MultiLineString>;

type MapMeta = {
  cells_lookup: CellLookup;
  cell_id: CellID;
  year: number;
};

export const map_meta_a = atom<MapMeta | null>({
  key: "map_meta_a",
  default: null,
});

export const map_meta_b = atom<MapMeta | null>({
  key: "map_meta_b",
  default: null,
});

const tmcs_a = selector({
  key: "tmcs_a",
  get: async ({ get }) => {
    const map_a = get(map_meta_a);

    if (map_a === null) {
      return null;
    }

    const { cells_lookup, cell_id, year } = map_a;

    const tmcs = await getTmcs(cells_lookup, cell_id, year);

    return { year, tmcs };
  },
});

const tmcs_b = selector({
  key: "tmcs_b",
  get: async ({ get }) => {
    const map_b = get(map_meta_b);

    if (map_b === null) {
      return null;
    }

    const { cells_lookup, cell_id, year } = map_b;

    const tmcs = await getTmcs(cells_lookup, cell_id, year);

    return { year, tmcs };
  },
});

const tmc_features_a = selector({
  key: "tmc_features_a",
  get: async ({ get }) => {
    const { tmcs = null, year = null } = get(tmcs_a) || {};

    if (tmcs === null || year === null) {
      return null;
    }

    const feature_collection = turf.featureCollection(
      await getTmcFeatures(year, tmcs)
    );

    return feature_collection;
  },
});

const tmc_features_b = selector({
  key: "tmc_features_b",
  get: async ({ get }) => {
    const { tmcs = null, year = null } = get(tmcs_b) || {};

    if (tmcs === null || year === null) {
      return null;
    }

    const feature_collection = turf.featureCollection(
      await getTmcFeatures(year, tmcs)
    );

    return feature_collection;
  },
});

export const tmc_metadata_a = selector({
  key: "tmc_metadata_a",
  get: async ({ get }) => {
    const { tmcs = null, year = null } = get(tmcs_a) || {};

    if (tmcs === null || year === null) {
      return null;
    }

    const meta = await getTmcsMetadata(year, tmcs);

    return meta;
  },
});

export const tmc_metadata_b = selector({
  key: "tmc_metadata_b",
  get: async ({ get }) => {
    const { tmcs = null, year = null } = get(tmcs_b) || {};

    if (tmcs === null || year === null) {
      return null;
    }

    const meta = await getTmcsMetadata(year, tmcs);

    return meta;
  },
});

export const tmclinear_paths_metadata_a = selector({
  key: "tmclinear_paths_metadata_a",
  get: async ({ get }) => {
    const { tmcs = null, year = null } = get(tmcs_a) || {};

    if (tmcs === null || year === null) {
      return null;
    }

    const meta = await getTmcLinearPathsMeta(year, tmcs);

    return meta;
  },
});

export const tmclinear_paths_metadata_b = selector({
  key: "tmclinear_paths_metadata_b",
  get: async ({ get }) => {
    const { tmcs = null, year = null } = get(tmcs_b) || {};

    if (tmcs === null || year === null) {
      return null;
    }

    const meta = await getTmcLinearPathsMeta(year, tmcs);

    return meta;
  },
});

export const useMapYears = () => ({
  map_year_a: useRecoilValue(map_meta_a)?.year || null,
  map_year_b: useRecoilValue(map_meta_b)?.year || null,
});

// Change to use selector
export function useMapsMeta() {
  const setMapMetaA = useSetRecoilState(map_meta_a);
  const setMapMetaB = useSetRecoilState(map_meta_b);

  const updateMapsMeta = useCallback(
    (
      cells_lookup: CellLookup,
      layer_dependency_id_a: CellID,
      map_year_a: number,
      layer_dependency_id_b: CellID,
      map_year_b: number
    ) => {
      setMapMetaA({
        cells_lookup,
        cell_id: layer_dependency_id_a,
        year: map_year_a,
      });
      setMapMetaB({
        cells_lookup,
        cell_id: layer_dependency_id_b,
        year: map_year_b,
      });
    },
    [setMapMetaA, setMapMetaB]
  );

  return updateMapsMeta;
}

const createPairTransactionHook = (info_a: any, info_b: any) =>
  function () {
    const { alias: alias_a, atom: atom_a } = info_a;
    const { alias: alias_b, atom: atom_b } = info_b;

    const a = useRecoilValue(atom_a) as NonNullable<any> | null;
    const b = useRecoilValue(atom_b) as NonNullable<any> | null;

    const state = useRef<
      Record<string, NonNullable<any>> | Record<string, null>
    >(
      a === null || b === null
        ? { [alias_a]: null, [alias_b]: null }
        : { [alias_a]: a, [alias_b]: b }
    );

    // console.log("useCachedDataState:", { features_a, features_b, state });

    if (a === state.current[alias_a] && b === state.current[alias_b]) {
      return state.current;
    }

    if (a === null || b === null) {
      state.current = {
        [alias_a]: null,
        [alias_b]: null,
      };

      return state.current;
    }

    if (a !== state.current.a || b !== state.current.b) {
      state.current = {
        [alias_a]: a,
        [alias_b]: b,
      } as Record<string, NonNullable<any>>;
    }

    return state.current;
  };

// Change to use selector
export const useTmcFeatureCollections = createPairTransactionHook(
  { alias: "features_a", atom: tmc_features_a },
  { alias: "features_b", atom: tmc_features_b }
);

export const useTmcLinearPathsMetadata = createPairTransactionHook(
  { alias: "tmclinear_paths_a", atom: tmclinear_paths_metadata_a },
  { alias: "tmclinear_paths_b", atom: tmclinear_paths_metadata_b }
);
