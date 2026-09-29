declare module "lunar-javascript" {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getWeekInChinese(): string;
    getFestivals(): string[];
    getOtherFestivals(): string[];
    getLunar(): Lunar;
  }

  export class Lunar {
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
    getDayInGanZhi(): string;
    getYearShengXiao(): string;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getJieQi(): string;
    getFestivals(): string[];
    getOtherFestivals(): string[];
  }
}
