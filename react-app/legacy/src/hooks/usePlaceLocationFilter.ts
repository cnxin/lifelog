import { useEffect, useMemo, useRef, useState } from "react";
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

export interface PlaceLocationFilterInitialValue {
  country?: string;
  province?: string;
  city?: string;
  area?: string;
}

const ALL = "全部";
const UNSET = "未设置";
const UNGROUPED = "未分组";

export function usePlaceLocationFilter(places: Place[], initialValue: PlaceLocationFilterInitialValue = {}): PlaceLocationFilter {
  const initializedRef = useRef(false);
  const [country, setCountry] = useState(initialValue.country || ALL);
  const [province, setProvince] = useState(initialValue.province || ALL);
  const [city, setCity] = useState(initialValue.city || ALL);
  const [area, setArea] = useState(initialValue.area || ALL);

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
          .map((place) => placeProvinceLabel(place)),
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
            const inProvince = province === ALL || placeProvinceLabel(place) === province;
            return inCountry && inProvince;
          })
          .map((place) => placeCityLabel(place)),
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
            const inProvince = province === ALL || placeProvinceLabel(place) === province;
            const inCity = city === ALL || placeCityLabel(place) === city;
            return inCountry && inProvince && inCity;
          })
          .map((place) => placeAreaLabel(place)),
      ),
    ],
    [city, country, province, places],
  );

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
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
    return matchesPlaceLocationFilter(place, { country, province, city, area });
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

export function matchesPlaceLocationFilter(
  place: Pick<Place, "country" | "province" | "city" | "area">,
  filters: Pick<PlaceLocationFilter, "country" | "province" | "city" | "area">
) {
  const inCountry = filters.country === ALL || placeCountryLabel(place) === filters.country;
  const inProvince = filters.province === ALL || placeProvinceLabel(place) === filters.province;
  const inCity = filters.city === ALL || placeCityLabel(place) === filters.city;
  const inArea = filters.area === ALL || placeAreaLabel(place) === filters.area;
  return inCountry && inProvince && inCity && inArea;
}

export function placeCountryLabel(place: Pick<Place, "country">) {
  return place.country || "中国";
}

export function placeProvinceLabel(place: Pick<Place, "province">) {
  return place.province || UNSET;
}

export function placeCityLabel(place: Pick<Place, "city">) {
  return place.city || UNSET;
}

export function placeAreaLabel(place: Pick<Place, "area">) {
  return place.area || UNGROUPED;
}
