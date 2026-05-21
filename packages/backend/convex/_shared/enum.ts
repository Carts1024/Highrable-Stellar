import { v, type VLiteral } from "convex/values";

type TStringEnumMap<TValues extends readonly string[]> = {
  readonly [TKey in TValues[number]]: TKey;
};

function literalTuple<const TValues extends readonly [string, ...string[]]>(values: TValues) {
  return values.map((value) => v.literal(value)) as unknown as {
    [TKey in keyof TValues]: VLiteral<TValues[TKey]>;
  };
}

export function createStringEnum<const TValues extends readonly [string, ...string[]]>(
  values: TValues,
) {
  const map = {} as Record<TValues[number], TValues[number]>;

  for (const value of values) {
    (map as Record<string, TValues[number]>)[value] = value;
  }

  return {
    values,
    map: Object.freeze(map) as TStringEnumMap<TValues>,
    validator: v.union(...literalTuple(values)),
  } as const;
}
