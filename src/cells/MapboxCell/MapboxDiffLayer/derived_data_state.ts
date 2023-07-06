import { useRef } from "react";
import { selector, useRecoilValue } from "recoil";

import _ from "lodash";

import {
  map_meta_a,
  map_meta_b,
  tmc_metadata_a,
  tmc_metadata_b,
} from "./cached_data_state";
import { hovered_tmcs_atom, selected_tmcs_atom } from "./ui_state";
import { getTmcNetworkDescription } from "./api";

const projected_tmc_meta_a = selector({
  key: "projected_tmc_meta_a",
  get: async ({ get }) => {
    const meta = get(tmc_metadata_a);
    const hovered_tmcs = get(hovered_tmcs_atom);
    const selected_tmcs = get(selected_tmcs_atom);

    console.log({ meta, hovered_tmcs, selected_tmcs });

    if (selected_tmcs?.length) {
      return _.pick(meta, selected_tmcs);
    }

    if (hovered_tmcs?.length) {
      return _.pick(meta, hovered_tmcs);
    }

    return {};
  },
});

const projected_tmc_meta_b = selector({
  key: "projected_tmc_meta_b",
  get: async ({ get }) => {
    const meta = get(tmc_metadata_b);
    const hovered_tmcs = get(hovered_tmcs_atom);
    const selected_tmcs = get(selected_tmcs_atom);

    if (selected_tmcs?.length) {
      return _.pick(meta, selected_tmcs);
    }

    if (hovered_tmcs?.length) {
      return _.pick(meta, hovered_tmcs);
    }

    return {};
  },
});

// Change to use selector for complete TRANSACTION of both available.
export function useProjectedTmcMeta() {
  const tmc_meta_a = useRecoilValue(projected_tmc_meta_a);
  const tmc_meta_b = useRecoilValue(projected_tmc_meta_b);

  const state = useRef<{
    tmc_meta_a: any;
    tmc_meta_b: any;
  }>(
    tmc_meta_a === null || tmc_meta_b === null
      ? { tmc_meta_a: null, tmc_meta_b: null }
      : { tmc_meta_a, tmc_meta_b }
  );

  // console.log("useCachedDataState:", { features_a, features_b, state });

  if (
    tmc_meta_a === state.current.tmc_meta_a &&
    tmc_meta_b === state.current.tmc_meta_b
  ) {
    return state.current;
  }

  if (tmc_meta_a === null || tmc_meta_b === null) {
    state.current = {
      tmc_meta_a: null,
      tmc_meta_b: null,
    };

    return state.current;
  }

  if (
    tmc_meta_a !== state.current.tmc_meta_a ||
    tmc_meta_b !== state.current.tmc_meta_b
  ) {
    state.current = {
      tmc_meta_a,
      tmc_meta_b,
    };
  }

  return state.current;
}

const tmc_description = selector({
  key: "tmc_description",
  get: async ({ get }) => {
    const { year: map_year_a = null } = get(map_meta_a) || {};
    const { year: map_year_b = null } = get(map_meta_b) || {};

    // NOTE: Too expensive an API call to enable hovered.
    // NOTE: When decomposed, some element may be inexpensive.
    const selected_tmcs = get(selected_tmcs_atom);

    if (
      map_year_a === null ||
      map_year_b === null ||
      selected_tmcs?.length === 0
    ) {
      return null;
    }

    // TODO: If no data, hide the visualization with hide_if_empty checkbox.
    // TODO: Decompose getTmcNetworkDescription
    try {
      const tmc_description = await getTmcNetworkDescription(
        // @ts-ignore
        map_year_a,
        // @ts-ignore
        map_year_b,
        selected_tmcs?.[0] || null
      );

      return tmc_description;
    } catch (err) {
      console.error(err);
      return null;
    }
  },
});

export const useTmcDescription = () => useRecoilValue(tmc_description);
