declare module "lunar-javascript" {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
    getWeekInChinese(): string;
    toYmd(): string;
  }
  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar;
    getSolar(): Solar;
    getYear(): number;
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
    getDayInGanZhi(): string;
    getYearShengXiao(): string;
    getJieQi(): string;
    getFestivals(): string[];
    getOtherFestivals(): string[];
    getMonth(): number;
    getDay(): number;
    getMonthInChinese(): string;
    getDayInChinese(): string;
  }
  export class LunarYear {
    static fromYear(year: number): LunarYear;
    getLeapMonth(): number;
  }
  export class LunarMonth {
    static fromYm(year: number, month: number): LunarMonth | null;
    getDayCount(): number;
  }
}
