import { atom, useRecoilState } from "recoil";
import _ from "lodash";
import { useRef } from "react";

type TMC = string;

export const hovered_tmcs_atom = atom<TMC[] | null>({
  key: "atomic_hovered_tmcs",
  default: [],
});

export const selected_tmcs_atom = atom<TMC[] | null>({
  key: "atomic_selected_tmcs",
  default: [],
});

export default function useTmcsState() {
  const [hovered_tmcs, setHoveredTmcs] = useRecoilState(hovered_tmcs_atom);
  const [selected_tmcs, setSelectedTmcs] = useRecoilState(selected_tmcs_atom);

  const ref = useRef({
    hovered_tmcs,
    selected_tmcs,
    setHoveredTmcs,
    setSelectedTmcs,
  });

  if (
    !(
      _.isEqual(hovered_tmcs, ref.current.hovered_tmcs) &&
      _.isEqual(selected_tmcs, ref.current.selected_tmcs)
    )
  ) {
    ref.current = {
      hovered_tmcs,
      setHoveredTmcs,

      selected_tmcs,
      setSelectedTmcs,
    };
  }

  return ref.current;
}