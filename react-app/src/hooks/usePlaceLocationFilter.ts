import { useEffect, useMemo, useState } from "react";
import type { Place } from "../types";

export interface PlaceLocationFilter {
  country: string;
  province: string;
  city: string;
  area: string;
  setCountry: (value: string) => void;
  setProvince: (value: string) => void;
  setCity: (value: string) => void;
  setArea: (value: string) => void;
  countries: string[];
  provinceOptions: string[];
  cityOptions: string[];
  areaOptions: string[];
  matches: (place: Pick<Place, "country" | "province" | "city" | "area">) => boolean;
}

const ALL = "全部";

export function usePlaceLocationFilter(places: Place[]): PlaceLocationFilter {
  const [country, setCountry] = useState(ALL);
  const [province, setProvince] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [area, setArea] = useState(ALL);

  const countries = useMemo(
    () => [ALL, ...new Set(places.map((place) => place.country || "中国"))],
    [places],
  );

  const provinceOptions = useMemo(
    () => [
      ALL,
      ...new Set(
        places
          .filter((place) => country === ALL || place.country === country)
          .map((place) => place.province || "未设置"),
      ),
    ],
    [country, places],
  );

  const cityOptions = useMemo(
    () => [
      ALL,
      ...new Set(
        places
          .filter((place) => {
            const inCountry = country === ALL || place.country === country;
            const inProvince = province === ALL || (place.province || "未设置") === province;
            return inCountry && inProvince;
          })
          .map((place) => place.city || "未设置"),
      ),
    ],
    [country, province, places],
  );

  const areaOptions = useMemo(
    () => [
      ALL,
      ...new Set(
        places
          .filter((place) => {
            const inCountry = country === ALL || place.country === country;
            const inProvince = province === ALL || (place.province || "未设置") === province;
            const inCity = city === ALL || place.city === city;
            return inCountry && inProvince && inCity;
          })
          .map((place) => place.area || "未分组"),
      ),
    ],
    [city, country, province, places],
  );

  // 父级变化时重置子级
  useEffect(() => {
    setProvince(ALL);
    setCity(ALL);
    setArea(ALL);
  }, [country]);

  useEffect(() => {
    setCity(ALL);
    setArea(ALL);
  }, [province]);

  useEffect(() => {
    setArea(ALL);
  }, [city]);

  function matches(place: Pick<Place, "country" | "province" | "city" | "area">) {
    const inCountry = country === ALL || place.country === country;
    const inProvince = province === ALL || (place.province || "未设置") === province;
    const inCity = city === ALL || place.city === city;
    const inArea = area === ALL || place.area === area;
    return inCountry && inProvince && inCity && inArea;
  }

  return {
    country,
    province,
    city,
    area,
    setCountry,
    setProvince,
    setCity,
    setArea,
    countries,
    provinceOptions,
    cityOptions,
    areaOptions,
    matches,
  };
}
