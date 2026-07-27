import { describe, expect, it } from "vitest";
import type { RepertoireTexture, Topology } from "./ensemble";
import { textureOptions, topologyOptions } from "./options";

const expectedTopologyValues = [
  "all-to-all",
  "leader-follower",
  "sections",
  "click-track",
] as const;

const expectedTextureValues = [
  "pulse",
  "drone",
  "call-response",
  "rubato",
  "dense-rhythm",
] as const;

type Assert<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;

const topologyCoversModel: Assert<
  IsNever<Exclude<Topology, (typeof expectedTopologyValues)[number]>>
> = true;
const topologyContainsOnlyModelValues: Assert<
  IsNever<Exclude<(typeof expectedTopologyValues)[number], Topology>>
> = true;
const textureCoversModel: Assert<
  IsNever<Exclude<RepertoireTexture, (typeof expectedTextureValues)[number]>>
> = true;
const textureContainsOnlyModelValues: Assert<
  IsNever<Exclude<(typeof expectedTextureValues)[number], RepertoireTexture>>
> = true;

void topologyCoversModel;
void topologyContainsOnlyModelValues;
void textureCoversModel;
void textureContainsOnlyModelValues;

describe("simulation control options", () => {
  it("lists every topology value in UI order", () => {
    expect(topologyOptions.map((option) => option.value)).toEqual(expectedTopologyValues);
  });

  it("lists every repertoire texture value in UI order", () => {
    expect(textureOptions.map((option) => option.value)).toEqual(expectedTextureValues);
  });
});
