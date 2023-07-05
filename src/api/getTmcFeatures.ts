import { LRUCache } from "lru-cache";
import difference from "lodash/difference";
import turf from "@turf/turf";
import _ from "lodash";

import { API_URL } from "../config/api";

const options = {
  max: 25000,
};

type TmcFeatureProperties = { tmc: string };
export type TmcFeature = turf.Feature<
  turf.MultiLineString,
  TmcFeatureProperties
>;
type TmcFeaturesByID = Record<string, TmcFeature>;

const cache: LRUCache<string, TmcFeature> = new LRUCache(options);

export default async function getTmcFeatures(
  year: number,
  tmcs: string[]
): Promise<TmcFeature[]> {
  const keys = tmcs.map((tmc) => `${year}::${tmc}`);

  const cache_hit_features_by_id = keys
    .map((k) => cache.get(k))
    .filter(Boolean)
    .reduce((acc: TmcFeaturesByID, feature) => {
      const {
        properties: { tmc },
      } = feature!;

      acc[tmc] = feature!;

      return acc;
    }, {});

  const cache_hit_tmcs = Object.keys(cache_hit_features_by_id);
  const cache_miss_tmcs = difference(tmcs, cache_hit_tmcs);

  const response = await fetch(
    `${API_URL}/data-types/npmrds/network-analysis/getTmcFeatures`,
    {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ year, tmcs: cache_miss_tmcs }),
    }
  );

  const response_features_by_id = (await response.json()) as TmcFeaturesByID;

  const tmc_features_by_id = {
    ...cache_hit_features_by_id,
    ...response_features_by_id,
  };

  Object.entries(tmc_features_by_id).forEach(([tmc, feature]) => {
    const k = `${year}::${tmc}`;

    cache.set(k, feature);
  });

  return _.cloneDeep(
    tmcs.map((tmc) => tmc_features_by_id[tmc]).filter(Boolean)
  );
}
